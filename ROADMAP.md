# Roadmap — Private Set Intersection Demo

_Status: active · updated 2026-07-27_

A React demo of the Private Set Intersection protocol from *OpenConflict: Preventing
Real Time Map Hacks in Online Games* — interactive visualization, a roguelike demo,
and a raw-calculation walkthrough. The C++ port lives in the sibling `PSI_Cpp` repo.

## Shipped

- [x] Raw-calculation demo (protocol walkthrough, intermediate values, timing)
- [x] PSI visualization (Konva canvas, moving units + visibility circles, traditional reference)
- [x] Multi-level grid system (coarse + fine mesh for large datasets)
- [x] Web Worker integration to offload crypto and keep the UI responsive
- [x] Roguelike demo game (PSI decides which monsters are visible vs hidden)
- [x] Explainer docs (EC math, hash-to-group, H2 function, membership tags)
- [x] Cryptographic primitives (ristretto255 group, SHA-512 key derivation, BLAKE3 membership tags)
- [x] Safer curve choice (replaced NIST P-256 and the `H(x)*G` mapping with ristretto255)
- [x] Live deployment on Vercel
- [x] Multi-page SPA navigation (Home, Visualization, Roguelike, Raw Calculation)
- [x] Remove dead code (unused vars/functions; fixes the `CI=true` Vercel build)

## Next

- [ ] Optimize random-value generation (single seed + hash chain vs per-unit keygen)
- [ ] Reduce visualization lag from per-movement protocol overhead (scalar multiplications)

## Backlog

- [ ] WebAssembly optimization for performance
- [ ] Desktop-app alternative to the browser approach
- [ ] Dispute-resolution protocol
- [ ] End-of-game position / visibility verification (audit against rules)
