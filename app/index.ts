// index.ts: the app entry. Privy's polyfills first, then the router.
// They must load before any Privy or ethers code runs, so they cannot live in
// a screen or in _layout.tsx, which the router imports after itself.

import "fast-text-encoding";
import "react-native-get-random-values";
import "@ethersproject/shims";
import "expo-router/entry";
