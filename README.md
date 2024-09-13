# Private Set Intersection Demo

A minimally working demonstration of a Private Set Intersection (PSI).

The aim is to prove this can work in a Real Time Strategy game, as shown in the research paper [OpenConflict: Preventing Real Time Map Hacks in Online Games](https://www.shiftleft.org/papers/openconflict/).

## Description
This code is a simple demonstration of how PSI calculations work. It is currently missing the symmetric encryption part, however, that is trivial given that generating the shared keys from the private interections is difficult.

An obvious next step is to add the encryption steps. That would make the code on par (roughly) with the PSI protocol in the OpenConflict paper.

One deficiency of the OpenConflict solution is that it has no protection against players who lie about their positions or visibility. I think the problem of lying is one that can be solved. Essentially, the players would reveal their all their position and visibility sets at the end of the game. Then players can check those against the rules of the game to ensure the calculations were correct and fit with the physics of the game.

Additionally, there would need to be a dispute resolution protocol on order to adjudicate in times when one player disagrees with another. This would happen when one player cheats and then denies it.

The overall top-level stragey is outlined in a blog I wrote in June 2020: [Preventing cheaters in Fog Of War Games](https://edward-thomson.medium.com/preventing-cheaters-in-fog-of-war-games-69f202fbe107).

## Installation

1. Clone the repository:

```bash
 git clone https://github.com/EdwardAThomson/psi-demo.git
 cd vrf-loot-generator
```

2. Install dependencies:

```bash
 npm install
```


3. Run the app:

```bash
 npm start
```

This will start the app at http://localhost:3000.


## License
This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.


## Acknowledgements
- ChatGPT
- Everyone at the Decentralized Gaming Association [DGA Discord](https://discord.com/invite/eZEVrSd)
