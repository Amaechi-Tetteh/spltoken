import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { associated } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { Spltoken } from "../target/types/spltoken";
import{
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createInitializeMintInstruction
  }from "@solana/spl-token";

import {assert, expect} from 'chai'

describe("spltoken", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Spltoken as Program<Spltoken>;

  let associatedTokenAccount = undefined;
  const mintKey : anchor.web3.Keypair = anchor.web3.Keypair.generate();
  
  it("Mints a Token/NFT!", async () => {
   const key = anchor.AnchorProvider.env().wallet.publicKey;
   const lamports: number = await program.provider.connection.getMinimumBalanceForRentExemption(
    MINT_SIZE
   );

    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey, //Token/NFT
      key
    );

      const mint_tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: key,
          newAccountPubkey: mintKey.publicKey,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
          lamports,
        }),
        
       // Fire a transaction to create our mint account that is controlled by our anchor wallet
        createInitializeMintInstruction(
          mintKey.publicKey, 0, key, key
        ),

       // Create the ATA account that is associated with our mint on our anchor wallet
        createAssociatedTokenAccountInstruction(
          key, associatedTokenAccount, key, mintKey.publicKey
        )

      );

      const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, [mintKey]);
      
      console.log(
        await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
      );
  
      console.log("Account: ", res);
      console.log("Mint key: ", mintKey.publicKey.toString());
      console.log("User: ", key.toString());
  
      // Executes our code to mint our token into our specified ATA
      const tx =await program.methods.mintToken().accounts({
        mint: mintKey.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenAccount: associatedTokenAccount,
        owner: key,
      }).rpc();
  
      console.log("Transaction: ", tx)

      // Get minted token amount on the ATA for our anchor wallet
      const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data.parsed.info.tokenAmount.amount;
      assert.equal(minted, 1);
  });

  it("Transfer token", async () => {
    // Get anchor's wallet's public key
    const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
    // Wallet that will receive the token 
    const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    // The ATA for a token on the to wallet (but might not exist yet)
    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    // Fires a list of instructions
    const mint_tx = new anchor.web3.Transaction().add(
      // Create the ATA account that is associated with our To wallet
      createAssociatedTokenAccountInstruction(
        myWallet, toATA, toWallet.publicKey, mintKey.publicKey
      )
    );

    // Sends and create the transaction
    await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);

    // Executes our transfer smart contract 
    const tx = await program.methods.transferToken().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      from: associatedTokenAccount,
      signer: myWallet,
      to: toATA,
    }).rpc();
    console.log("TX: ", tx)
    
    // Get minted token amount on the ATA for our anchor wallet
    const minted = (await program.provider.connection.getParsedAccountInfo(toATA)).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 1);
  });
});
