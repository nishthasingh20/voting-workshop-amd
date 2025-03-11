import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Voting } from "../target/types/voting";

const IDL = require("../target/idl/voting.json");
const PROGRAM_ID = new PublicKey(IDL.address);

describe("Voting", () => {
  let context;
  let provider;
  let votingProgram: anchor.Program<Voting>;

  beforeAll(async () => {
    context = await startAnchor('', [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(
      IDL,
      provider,
    );
  });

  it("initializes a poll", async () => {
    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(100),
      new anchor.BN(1739370789),
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    console.log(poll);

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(100);
  });

  it("initializes candidates", async () => {
    await votingProgram.methods.initializeCandidate(
      "Pink",
      new anchor.BN(1),
    ).rpc();
    await votingProgram.methods.initializeCandidate(
      "Blue",
      new anchor.BN(1),
    ).rpc();

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    console.log(pinkCandidate);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(0);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    console.log(blueCandidate);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(0);
    expect(blueCandidate.candidateName).toBe("Blue");

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    // Check the candidate amount
    const poll = await votingProgram.account.poll.fetch(pollAddress);
    expect(poll.candidateAmount).toBe(2);
  });

  // Check voting start
  it("fails to vote because voting has not started", async () => {
    await expect(
      votingProgram.methods
        .vote("Pink", new anchor.BN(1))
        .rpc()
    ).rejects.toThrow(/VotingNotStarted/);
  });

  // Check voting end
  it("fails to vote because voting has ended", async () => {
    await expect(
      votingProgram.methods
        .vote("Pink", new anchor.BN(1))
        .rpc()
    ).rejects.toThrow(/VotingClosed/);
  });

  it("vote candidates", async () => {
    await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();
    await votingProgram.methods.vote("Blue", new anchor.BN(1)).rpc();
    await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    console.log("Pink Candidate:", pinkCandidate);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(2);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    console.log("Blue Candidate:", blueCandidate);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(1);
    expect(blueCandidate.candidateName).toBe("Blue");

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId
    );

    // Check the poll votes
    const poll = await votingProgram.account.poll.fetch(pollAddress);
    console.log("Poll Data:", poll);
    expect(poll.pollVotes.toNumber()).toBe(3);
  });

  // Fails to create poll
  it("fails to initialize a poll due to invalid poll_end timestamp", async () => {
    await expect(
      votingProgram.methods
        .initializePoll(
          new anchor.BN(2),
          "Is Solana the fastest blockchain?",
          new anchor.BN(100),
          new anchor.BN(Math.floor(Date.now() / 1000) - 100) // Invalid poll_end 
        )
        .rpc()
    ).rejects.toThrow(/InvalidUnixTimestamp/);
  });
});