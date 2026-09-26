// index.ts: the app entry. Cavos's runtime shim first, then the router.
// The shim installs crypto.getRandomValues and a Buffer that Stellar's XDR
// needs on Hermes; it must run before any chain code loads.

import "@cavos/kit/react-native";
import "expo-router/entry";
