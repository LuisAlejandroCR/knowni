<!-- README.md -->
Front page: what Knowni proves, what already runs (with testnet evidence), what does not yet,
and how to run it. The reasoning behind each decision lives in docs/memoria.md.

# Knowni

**Demuestra que calificas para firmar, sin decir quién eres.**

[Español](#español) · [English](#english)

---

## Español

Para firmar un contrato en Colombia entregas un expediente: cédula, certificaciones, desprendibles,
certificado de tradición. La contraparte no necesita el expediente. Necesita respuestas:

| Pregunta | Lo que hoy entregas | Lo que Knowni entrega |
|---|---|---|
| ¿Existe y es quien dice ser? | Cédula escaneada | `true` |
| ¿Puede contratar? | Nada, o una consulta a tu nombre | `true` |
| ¿Hay una inhabilidad vigente? | Antecedentes de todo tipo | `true` |
| ¿Le alcanza? | Certificación bancaria, nómina | `STRONG` (≥3× la obligación) |
| ¿El activo está limpio? | Certificado de tradición, paz y salvo | `true` |

Ni nombre, ni número de cédula, ni salario. La lista exacta de campos que cruzan la red está
comprobada en [`core/test/invariant/disclosure.invariant.spec.ts`](core/test/invariant/disclosure.invariant.spec.ts).
El tipo de contrato es un **perfil** de la solicitud (qué predicados, con qué umbrales), no una rama
del producto. Nunca se consultan antecedentes penales ni Sisbén.

### Qué corre hoy

Grabado en un iPhone físico el 2026-09-26 (build de desarrollo), en video y sin maquetas:

1. Llega una solicitud firmada, que vence.
2. La persona elige qué fuentes se consultan.
3. **Paga primero:** la wallet de Cavos, que vive en el teléfono, paga 1.2 XLM al emisor.
4. El emisor verifica el pago en Stellar y **solo entonces** consulta la Registraduría vía
   [Croma](https://docs.usecroma.com).
5. La contraparte recibe una sola respuesta firmada: *documento vigente: sí*. Una respuesta
   repetida se rechaza.

| Evidencia en Stellar testnet | Transacción |
|---|---|
| Pago de 1.2 XLM al emisor dentro del recorrido, firmado en el iPhone | [`53e6ea60…2724`](https://stellar.expert/explorer/testnet/tx/53e6ea60810e6c585c48a45d4fa095aa73e6bdaffdb3be5f7cec71f3ddd52724) |
| La misma cuenta del iPhone firma tras cerrar la app | [`1c07f12e…7127`](https://stellar.expert/explorer/testnet/tx/1c07f12ec292d07fb809f768a0fb1653fe215bee3444a06b5de2ed1de6227127) |
| Contrato Soroban desplegado verifica una prueba Groth16 real (y rechaza una alterada) | [`0db7a479…0191`](https://stellar.expert/explorer/testnet/tx/0db7a4790d02c3277877ef4b9e79b3449004735928cb73b192bc7694003b0191) |
| Digest del registro de emisores anclado y leído de vuelta | [`66bf1b7d…fc49`](https://stellar.expert/explorer/testnet/tx/66bf1b7dffe75e06517389a851f9ecc526b3847e07a13f009c996d943cb4fc49) |
| Compromiso cegado como `MEMO_HASH` (32 bytes, nada más) | [`0dc0fdf4…8161`](https://stellar.expert/explorer/testnet/tx/0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161) |

Además, un moto g54 (Android) genera la prueba Groth16 en 9,7 s la primera vez y 1,3 s después.
Cada afirmación tiene su fila, con fecha, en [`docs/verificacion.md`](docs/verificacion.md).

### Qué falta, dicho sin adornos

- **La segunda persona:** el verificador corre en el mismo teléfono; la entrega a otro dispositivo
  no ha corrido.
- **La prueba ZK en el iPhone**, y la prueba del teléfono verificada en cadena: la del teléfono es
  Android y local; la que verificó el contrato salió del portátil. Todo con llave de desarrollo.
- **Más fuentes con consentimiento real:** solo la Registraduría. PILA no está en Croma, y SICAAC,
  listas, RUNT y SIMIT no se han consultado sobre una persona real.
- **Modo avión en un teléfono físico** y el emisor fuera del portátil.

### Estructura

| Carpeta | Qué hace |
|---|---|
| [`core/`](core/) | Reclamos, predicados, compromisos, Merkle y el sobre de divulgación. Sin dependencias ni SDK de cadena |
| [`sources/`](sources/) | Adaptadores de fuentes oficiales (Croma), Colombia primero |
| [`issuer/`](issuer/README.md) | Emisor: cotiza, verifica el pago en Stellar, consulta y firma la respuesta |
| [`app/`](app/README.md) | iOS y Android (Expo): recorrido, wallet Cavos, verificador |
| [`anchoring/`](anchoring/) | Puerto de anclaje con adaptadores Stellar y memoria |
| [`circuits/`](circuits/README.md) | Circuitos Circom sobre BLS12-381 |
| [`contracts/knowni-verifier/`](contracts/knowni-verifier/) | Verificador Soroban, desplegado en testnet |

Colombia es la primera jurisdicción y Stellar la primera cadena, no el diseño: nada en `core/`
sabe de ninguna de las dos.

### Correrlo

Node 22.18+.

```bash
npm install
npm run verify   # lint + typecheck + 504 pruebas
```

La app tiene su propio README: [`app/README.md`](app/README.md). Empieza a leer por
[`journey/test/unit/journey.spec.ts`](journey/test/unit/journey.spec.ts): el recorrido completo, sin
red y sin mocks.

### Documentos

- [`docs/plan.md`](docs/plan.md): alcance y criterios de aceptación.
- [`docs/memoria.md`](docs/memoria.md): decisiones, con su razón y su fecha.
- [`docs/verificacion.md`](docs/verificacion.md): qué está comprobado, contra qué y cuándo.
- [`docs/CROMA.md`](docs/CROMA.md): la fuente de datos.

---

## English

**Prove you qualify to sign, without saying who you are.**

Signing a contract in Colombia costs a full dossier. The counterparty does not need it; it needs
answers: does this person exist, can they contract, is there a standing disqualification, can they
cover it, is the asset clean. Knowni returns only those answers, signed by an issuer.

**What runs today** (recorded on a physical iPhone, 2026-09-26): a signed request arrives, the
person picks which sources may be queried, the on-device Cavos wallet pays the issuer 1.2 XLM on
Stellar testnet ([`53e6ea60…`](https://stellar.expert/explorer/testnet/tx/53e6ea60810e6c585c48a45d4fa095aa73e6bdaffdb3be5f7cec71f3ddd52724)),
the issuer verifies the payment and only then queries the national registry through Croma, and the
counterparty receives one signed answer, *document valid: yes*. A deployed Soroban contract has
verified a real Groth16 proof ([`0db7a479…`](https://stellar.expert/explorer/testnet/tx/0db7a4790d02c3277877ef4b9e79b3449004735928cb73b192bc7694003b0191)).

**Not yet:** a second person on a second device, the proof generated on the iPhone, and consented
queries beyond the registry. See the Spanish section for the full evidence table and layout.

---

Licensed Apache-2.0.
