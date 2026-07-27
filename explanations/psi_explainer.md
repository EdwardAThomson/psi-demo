# Private Set Intersection (PSI) Explanation page

## Private Set Intersection (PSI) Overview
Private Set Intersection (PSI) is a cryptographic technique that allows two parties to find common elements in their datasets without revealing any non-matching items. This process ensures privacy, as neither party learns anything about the other’s data beyond the shared elements.

In our example, Alice and Bob are both players in a mock RTS game. Each player has a set of units, and they want to determine if they have any common units without revealing the details of their armies to each other.

How It Works:
1. **Key Exchange**: Alice and Bob begin by following a protocol that enables them to generate and exchange cryptographic keys. This is the foundation for ensuring the privacy of their data throughout the process.

2. **Tagging and Blinding**: Bob derives a secret key per unit (by multiplying the unit's curve point by his private scalar) and sends a one-way membership tag of each key. Alice blinds each of her units with an independent random scalar and sends the blinded curve points. Neither message contains any unit position in the clear; every wire entry is a fixed 32-byte value.

3. **Intersection Identification**: Bob multiplies Alice's blinded points by his private scalar and returns them. Alice unblinds each reply with the modular inverse of her random scalar, recomputes the tag, and checks it against Bob's tag set. A match at index i means her own unit i is in the intersection. She learns nothing about Bob's non-matching units, and Bob learns nothing about hers.

By the end of this protocol, both Alice and Bob only know about the units they have in common, without exposing any other information.


## Protocol Details
Here is a deeper dive into the protocol details. As it is a pain to copy and paste the text from ChatGPT, it is easier to provide a screenshot:

![PSI Protocol Deatails](psi_details.png)


## Key Concepts

### Concept of HashToGroup:
In the research paper there is a hash function, **H1**, which is somewhat different from a regular hash function.

**HashToGroup** typically means hashing an input (like a string or integer) to an element in a cryptographic group. In our case, the group is the elliptic curve group 𝐺, consisting of elliptic curve points.

The goal is to take some arbitrary input, like a string, and map it deterministically to a valid point on the elliptic curve. This is useful in protocols like the one we’re working on because you need inputs (like unit positions) to be represented as curve points for operations like scalar multiplication.

HashToGroup is conceptually similar to HashToCurve, as seen in VRFs, but they are slightly different.

**Important**: the construction matters. This demo originally computed `H1(x) = H(x)*G`, a hash used as a scalar times the generator. That means the discrete log of every mapped point is public, which breaks the protocol: after one run a participant can recover `b*G` and enumerate the other party's set offline. The current implementation hashes the element with SHA-512 and maps the 64 uniform bytes to a ristretto255 point via RFC 9496 element derivation (the same construction as libsodium's `crypto_core_ristretto255_from_hash`), so the output point has an unknown discrete log.

### The H2 Function in the PSI Protocol (PSI Demo):

**Purpose**
The **H2** function in the PSI protocol is designed to map elliptic curve points to a fixed-size bit string (often used for encryption, MACs, or comparison purposes). This bit string could, for instance, be used as a symmetric key in an encryption scheme like AES or for hashing data in a PSI protocol.

It doesn't generate a scalar like in your VRF code, but instead hashes an elliptic curve point (or some other data) to a string of bits.

**Process**
The input (which is often an elliptic curve point, or something derived from it) is hashed to a bit string (e.g., using SHA-256 or SHA-512). This bit string could then be used as a key, for example.


### Elliptic Curve Choice:

#### ristretto255

The demo uses [ristretto255](https://ristretto.group/), a prime-order group built on Curve25519. It was chosen because it provides a standard, safe hash-to-group construction (RFC 9496 element derivation from 64 uniform bytes) with no known discrete log, it has no cofactor edge cases, and every point encodes to a fixed 32 bytes. Earlier versions of this demo used NIST P-256 with an insecure `H(x)*G` mapping; see the HashToGroup section above for why that was replaced.

There is a website that digs into curve safety run by Daniel J. Bernstein and Tanja Lange: [SafeCurves: choosing safe curves for elliptic-curve cryptography](https://safecurves.cr.yp.to/).

### Membership tags instead of encryption:

Earlier versions encrypted each of Bob's unit positions under the derived key (ChaCha20/secretbox) and had Alice trial-decrypt every ciphertext with every candidate key, an O(A*B) step that also leaked each element's length through the ciphertext size.

The current protocol sends a one-way membership tag per element instead: BLAKE3 in derive-key mode with the context string `PSI-membership-tag-v1` over the 32-byte derived key. Alice hashes her recomputed keys the same way and checks membership in a set of Bob's tags, which is O(A) lookups. Tags are fixed 32-byte values, so nothing about the underlying element (not even its length) is revealed. Since Alice matches a tag at her own index i, she knows the intersecting element is her own input i, so no decryption is needed at all.

### Threat model

The protocol is private against honest-but-curious participants. A malicious participant can probe membership with fabricated inputs (claiming positions they do not hold); preventing that requires a commitment and dispute-resolution layer on top, as discussed in the README.
