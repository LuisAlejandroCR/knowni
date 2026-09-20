// vehicle.ts: assetStanding for a vehicle, from RUNT and SIMIT.
// RUNT says the plate exists and whether anything is registered against it;
// SIMIT says whether fines are outstanding. The claim is about the CAR.

import type { AssetStandingClaim } from "@knowni/core";
import type { SourceResult } from "../../types.ts";
import { degraded } from "../../types.ts";
import type { CromaClient } from "../../providers/croma/client.ts";

export const RUNT_VEHICLE_PATH = "/co/runt/vehicle-by-plate/v1";
export const SIMIT_PATH = "/co/simit/account-status/v1";

// An asset is not a SubjectLookup: it has a plate, not a document, and the
// owner's document travels only because RUNT requires it to authorise the
// query — it never reaches the claim.
export interface VehicleLookup {
  readonly plate: string;
  readonly ownerDocumentNumber: string;
  // Salted reference of the PLATE. Same construction as a subjectRef, so a
  // relying party cannot join two checks of the same car across deals.
  readonly assetRef: string;
}

export interface VehicleStandingPort {
  readonly id: string;
  readonly jurisdiction: string;
  readonly produces: "assetStanding";
  fetch(asset: VehicleLookup, nowUnix: number): Promise<SourceResult>;
}

function asArray(record: Record<string, unknown>, field: string): unknown[] | undefined {
  const value = record[field];
  return Array.isArray(value) ? value : undefined;
}

export function createVehicleStandingSource(client: CromaClient): VehicleStandingPort {
  return {
    id: "co-runt-simit-vehicle",
    jurisdiction: "CO",
    produces: "assetStanding",
    async fetch(asset: VehicleLookup, nowUnix: number): Promise<SourceResult> {
      const [runt, simit] = await Promise.all([
        client.call(RUNT_VEHICLE_PATH, {
          plate: asset.plate,
          document_number: asset.ownerDocumentNumber,
        }),
        client.call(SIMIT_PATH, { document_number: asset.plate }),
      ]);

      if (runt.status === "degraded") return degraded(runt.reason);
      if (simit.status === "degraded") return degraded(simit.reason);

      if (typeof runt.data !== "object" || runt.data === null) return degraded("invalid_response");
      if (typeof simit.data !== "object" || simit.data === null) return degraded("invalid_response");
      const vehicle = runt.data as Record<string, unknown>;
      const account = simit.data as Record<string, unknown>;

      if (typeof vehicle.found !== "boolean") return degraded("invalid_response");
      // A plate with no RUNT record is not an unencumbered car. It is a
      // plate nobody can vouch for, and a buyer needs that said plainly.
      if (!vehicle.found) return degraded("not_found");

      const pledges = asArray(vehicle, "pledges");
      const limitations = asArray(vehicle, "ownership_limitations");
      if (pledges === undefined || limitations === undefined) return degraded("invalid_response");

      // `clear` is SIMIT's own paz-y-salvo verdict. Counting fines
      // ourselves would mean deciding which ones are payable, which is the
      // source's job and not the adapter's.
      const clear = account.clear;
      if (typeof clear !== "boolean") return degraded("invalid_response");

      const claim: AssetStandingClaim = {
        kind: "assetStanding",
        jurisdiction: "CO",
        subjectRef: { hex: asset.assetRef },
        registered: true,
        // Who the creditor is, what the lien is worth and when it was filed
        // are all in the response. Only their existence answers the buyer's
        // question, so only their existence survives.
        encumbered: pledges.length > 0 || limitations.length > 0,
        finesOutstanding: !clear,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}
