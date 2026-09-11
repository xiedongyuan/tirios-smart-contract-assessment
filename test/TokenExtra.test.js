const Token = artifacts.require("Token");

contract("Token - Extra Tests", (accounts) => {
  const [owner, alice, bob, spender] = accounts;

  let token;

  beforeEach(async () => {
    token = await Token.new();
  });

  describe("ERC20", () => {

    it("approve and allowance", async () => {
      await token.approve(spender, 100, {
        from: owner
      });

      const allowance = await token.allowance(owner, spender);

      assert.equal(
        allowance.toString(),
        "100"
      );
    });

    it("transfer", async () => {
      await token.mint({
        from: owner,
        value: 1000
      });

      await token.transfer(alice, 300, {
        from: owner
      });

      const ownerBalance = await token.balanceOf(owner);
      const aliceBalance = await token.balanceOf(alice);

      assert.equal(ownerBalance.toString(), "700");
      assert.equal(aliceBalance.toString(), "300");
    });

    it("transferFrom", async () => {
      await token.mint({
        from: owner,
        value: 1000
      });

      await token.approve(spender, 400, {
        from: owner
      });

      await token.transferFrom(owner, alice, 300, {
        from: spender
      });

      const aliceBalance = await token.balanceOf(alice);
      const remainingAllowance = await token.allowance(
        owner,
        spender
      );

      assert.equal(aliceBalance.toString(), "300");
      assert.equal(remainingAllowance.toString(), "100");
    });

    it("cannot transfer without enough balance", async () => {
      try {
        await token.transfer(alice, 100, {
          from: owner
        });

        assert.fail("transaction should fail");
      } catch (error) {
        assert(
          error.message.includes("insufficient balance")
        );
      }
    });

    it("cannot transferFrom without allowance", async () => {
      await token.mint({
        from: owner,
        value: 1000
      });

      try {
        await token.transferFrom(owner, alice, 100, {
          from: spender
        });

        assert.fail("transaction should fail");
      } catch (error) {
        assert(
          error.message.includes("insufficient allowance")
        );
      }
    });
  });

  describe("Mint and Burn", () => {

    it("mint increases balance and totalSupply", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      const balance = await token.balanceOf(alice);
      const totalSupply = await token.totalSupply();

      assert.equal(balance.toString(), "1000");
      assert.equal(totalSupply.toString(), "1000");
    });

    it("burn returns ETH", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      const balanceBefore = await token.balanceOf(alice);

      assert.equal(balanceBefore.toString(), "1000");

      await token.burn(bob, {
        from: alice
      });

      const balanceAfter = await token.balanceOf(alice);
      const totalSupply = await token.totalSupply();

      assert.equal(balanceAfter.toString(), "0");
      assert.equal(totalSupply.toString(), "0");
    });

    it("cannot mint zero ETH", async () => {
      try {
        await token.mint({
          from: alice,
          value: 0
        });

        assert.fail("transaction should fail");
      } catch (error) {
        assert(
          error.message.includes("must send ETH")
        );
      }
    });

    it("cannot burn without token balance", async () => {
      try {
        await token.burn(bob, {
          from: alice
        });

        assert.fail("transaction should fail");
      } catch (error) {
        assert(
          error.message.includes("no token balance")
        );
      }
    });
  });

  describe("Token Holders", () => {

    it("tracks token holders", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      await token.mint({
        from: bob,
        value: 500
      });

      const count = await token.getNumTokenHolders();

      assert.equal(count.toString(), "2");
    });

    it("removes holder after burning all tokens", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      assert.equal(
        (await token.getNumTokenHolders()).toString(),
        "1"
      );

      await token.burn(bob, {
        from: alice
      });

      assert.equal(
        (await token.getNumTokenHolders()).toString(),
        "0"
      );
    });
  });

  describe("Dividends", () => {

    it("records dividends according to token balance", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      await token.mint({
        from: bob,
        value: 1000
      });

      await token.recordDividend({
        from: owner,
        value: 1000
      });

      const aliceDividend =
        await token.getWithdrawableDividend(alice);

      const bobDividend =
        await token.getWithdrawableDividend(bob);

      assert.equal(aliceDividend.toString(), "500");
      assert.equal(bobDividend.toString(), "500");
    });

    it("compounds dividends", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      await token.recordDividend({
        from: owner,
        value: 1000
      });

      await token.recordDividend({
        from: owner,
        value: 500
      });

      const dividend =
        await token.getWithdrawableDividend(alice);

      assert.equal(dividend.toString(), "1500");
    });

    it("withdraws dividend", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      await token.recordDividend({
        from: owner,
        value: 1000
      });

      const before =
        await token.getWithdrawableDividend(alice);

      assert.equal(before.toString(), "1000");

      await token.withdrawDividend(bob, {
        from: alice
      });

      const after =
        await token.getWithdrawableDividend(alice);

      assert.equal(after.toString(), "0");
    });

    it("cannot record empty dividend", async () => {
      await token.mint({
        from: alice,
        value: 1000
      });

      try {
        await token.recordDividend({
          from: owner,
          value: 0
        });

        assert.fail("transaction should fail");
      } catch (error) {
        assert(
          error.message.includes("must send ETH")
        );
      }
    });

    it("cannot withdraw when there is no dividend", async () => {
      try {
        await token.withdrawDividend(bob, {
          from: alice
        });

        assert.fail("transaction should fail");
      } catch (error) {
        assert(
          error.message.includes("no dividend")
        );
      }
    });
  });
});