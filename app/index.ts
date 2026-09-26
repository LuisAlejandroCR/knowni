// index.ts: the app entry. crypto.getRandomValues first, then Cavos's shim, then the router.
// @noble reads globalThis.crypto once, when it is imported, so the random source
// must exist before any chain code loads; Cavos's shim adds the Buffer XDR needs.

import "react-native-get-random-values";
import "@cavos/kit/react-native";
import "expo-router/entry";
