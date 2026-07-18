# Sample program binaries

Drop your pre-compiled Thru program binaries here to enable real on-chain
deployment of the **Counter** and **Hello World** samples in the Deploy step.

Expected files (referenced by `lib/thru/deploy.ts`):

```
public/programs/counter.bin
public/programs/hello_world.bin
```

## How deployment works on Thru

Deploying a program is a two-account process:

1. A **Buffer** account is created and the program bytecode is written into it.
2. The bytecode is finalized into a **Meta** (program) account, which becomes
   the callable program address.

Both addresses are surfaced to the user on the success screen.

## Enabling on-chain deploys

1. Compile your programs and place the `.bin` files here.
2. Set `NEXT_PUBLIC_PROGRAM_LOADER_ADDRESS` in your environment to the address
   of the loader program on your target network.
3. Wire the loader's buffer/finalize instructions into
   `deployTokenOnChain`'s sibling function in `lib/thru/deploy.ts` (a
   `deployProgramOnChain` stub location is marked with a comment).

Until a loader address is configured, these options run in **preview mode**:
the app derives the genuine Meta and Buffer addresses (using the SDK's real
address-derivation primitives) so users can see and copy them, without
submitting a transaction.

> The **Simple Token** option, by contrast, deploys for real as soon as
> `NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS` is set — it uses the official
> `@thru/programs/token` instruction builders.
