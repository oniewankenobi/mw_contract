const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

function parseToWei(value, decimals) {
    return ethers.utils.parseUnits( value.toString(), decimals );
}

function parseToDecimal(value, decimals) {
    return ethers.utils.formatUnits( value.toString(), decimals );
}

function arrayProofMerkletTree(merkleTree, address){
    var proofWallet = merkleTree.getProof(keccak256(address));
    proofWallet = proofWallet.map(proof => ethers.utils.defaultAbiCoder.encode(['bytes32'], [proof.data]));
    return proofWallet;
}

describe("MeemosWorld", function () {

  let owner;
  let wallet1;
  let wallet2;
  let wallet3;
  let wallet4;
  let meemosWorld;
  let whitelist;
  let leafNodes;
  let merkleTree;
  let rootHash;

  before(async function() {
      const MeemosWorld = await ethers.getContractFactory("MeemosWorld");
      meemosWorld = await MeemosWorld.deploy();
      await meemosWorld.deployed();

      [owner, wallet1, wallet2, wallet3, wallet4] = await ethers.getSigners();

      whitelist = [
          wallet1.address,
          wallet2.address,
          wallet3.address
      ]
      leafNodes = whitelist.map(addr => keccak256(addr));
      merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
      rootHash = ethers.utils.defaultAbiCoder.encode(['bytes32'], [merkleTree.getRoot()]);

      console.log('Whitelist Merkle Tree\n', merkleTree.toString());
      console.log('Root Hash:', rootHash);
  });

  it("Airdrop for devs", async function () {

      // Expects to distribute 100 mints to devs
      const airdropMint1 = await meemosWorld.reservedDevsMint(33, owner.address);
      await airdropMint1.wait();

      const airdropMint2 = await meemosWorld.reservedDevsMint(33, wallet1.address);
      await airdropMint2.wait();

      const airdropMint3 = await meemosWorld.reservedDevsMint(34, wallet2.address);
      await airdropMint3.wait();

      expect(await meemosWorld.balanceOf(owner.address)).to.equal(33);
      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(33);
      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(34);
      // Fail because exceed airdrop
      await expect(meemosWorld.reservedDevsMint(10, owner.address)).to.be.revertedWith("Exceeds airdrop for devs");
  });

  it("Whitelist mint", async function () {

      const wallet1Connect = await meemosWorld.connect(wallet1);
      const wallet2Connect = await meemosWorld.connect(wallet2);
      const wallet3Connect = await meemosWorld.connect(wallet3);
      const price = await meemosWorld.price();

      // Setting root for contract whitelist
      const setRoot = await meemosWorld.setRoot(rootHash);
      await setRoot.wait();

      // Fail because whitelist not active
      var proofWallet1 = arrayProofMerkletTree(merkleTree, wallet1.address);
      await expect(wallet1Connect.whitelistMint(1, proofWallet1, {value: price})).to.be.revertedWith("Whitelist sale not active");

      // Activate whitelist
      const toggleWhitelistSale = await meemosWorld.setWhitelistSale(true);
      await toggleWhitelistSale.wait();

      // Fail 0 mints
      await expect(wallet1Connect.whitelistMint(0, proofWallet1, {value: 0})).to.be.revertedWith("No 0 mints");
      // Fail 3 mints
      await expect(wallet1Connect.whitelistMint(3, proofWallet1, {value: price.mul(3)})).to.be.revertedWith("Excess max per whitelist tx");
      // Fail bad price
      await expect(wallet1Connect.whitelistMint(1, proofWallet1, {value: price.add(1)})).to.be.revertedWith("Invalid funds provided");

      // Mint 1 and 1
      var mintWhitelist1 = await wallet1Connect.whitelistMint(1, proofWallet1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(34);

      mintWhitelist1 = await wallet1Connect.whitelistMint(1, proofWallet1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(35);

      // Mint 2
      var proofWallet2 = arrayProofMerkletTree(merkleTree, wallet2.address);
      var mintWhitelist2 = await wallet2Connect.whitelistMint(2, proofWallet2, {value: price.mul(2)});
      await mintWhitelist2.wait();

      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(36);

      // Fail invalid merkle proof
      await expect(wallet3Connect.whitelistMint(2, proofWallet2, {value: price.mul(2)})).to.be.revertedWith("Invalid proof");

      // Mint 2
      var proofWallet3 = arrayProofMerkletTree(merkleTree, wallet3.address);
      var mintWhitelist3 = await wallet3Connect.whitelistMint(2, proofWallet3, {value: price.mul(2)});
      await mintWhitelist3.wait();

      expect(await meemosWorld.balanceOf(wallet3.address)).to.equal(2);
      // Fail Max mints per whitelist wallet 1
      await expect(wallet3Connect.whitelistMint(1, proofWallet3, {value: price})).to.be.revertedWith("Max mints per whitelist wallet");
      // Fail Max mints per whitelist wallet 2
      await expect(wallet3Connect.whitelistMint(2, proofWallet3, {value: price.mul(2)})).to.be.revertedWith("Max mints per whitelist wallet");
  });

  it("Public mint", async function () {

      const wallet1Connect = await meemosWorld.connect(wallet1);
      const wallet2Connect = await meemosWorld.connect(wallet2);
      const wallet3Connect = await meemosWorld.connect(wallet3);
      const wallet4Connect = await meemosWorld.connect(wallet4);
      const price = await meemosWorld.price();

      // Fail because public not active
      await expect(wallet1Connect.mint(1, {value: price})).to.be.revertedWith("Public sale not active");

      // Deactivate whitelist
      const toggleWhitelistSale = await meemosWorld.setWhitelistSale(false);
      await toggleWhitelistSale.wait();

      // Activate public
      const togglePublicSale = await meemosWorld.setPublicSale(true);
      await togglePublicSale.wait();

      // Fail 0 mints
      await expect(wallet1Connect.mint(0, {value: 0})).to.be.revertedWith("No 0 mints");
      // Fail 6 mints
      await expect(wallet1Connect.mint(6, {value: price.mul(6)})).to.be.revertedWith("Excess max per public tx");
      // Fail bad price
      await expect(wallet1Connect.mint(1, {value: price.add(1)})).to.be.revertedWith("Invalid funds provided");

      // Mint 3 in 1
      var mintWhitelist1 = await wallet1Connect.mint(1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(36);

      var mintWhitelist1 = await wallet1Connect.mint(1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(37);

      var mintWhitelist1 = await wallet1Connect.mint(1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(38);

      // Mint 3
      var mintWhitelist2 = await wallet2Connect.mint(3, {value: price.mul(3)});
      await mintWhitelist2.wait();

      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(39);

      // Mint 3
      var mintWhitelist3 = await wallet3Connect.mint(3, {value: price.mul(3)});
      await mintWhitelist3.wait();

      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(39);

      // Mint 5
      var mintWhitelist4 = await wallet4Connect.mint(5, {value: price.mul(5)});
      await mintWhitelist4.wait();

      expect(await meemosWorld.balanceOf(wallet4.address)).to.equal(5);

      // Fail Max mints per wallet 1
      await expect(wallet1Connect.mint(1, {value: price})).to.be.revertedWith("Max mints per wallet");
      // Fail Max mints per wallet 5
      await expect(wallet4Connect.mint(5, {value: price.mul(5)})).to.be.revertedWith("Max mints per wallet");

      // Reduce total supply
      const reduceSupply = await meemosWorld.reduceSupply(await meemosWorld.totalSupply());
      await reduceSupply.wait();

      // Fail max supply trying to mint
      await expect(wallet1Connect.mint(1, {value: price})).to.be.revertedWith("Exceeds max supply");
  });

  it("Set new baseURI", async function () {

      var baseURI = "ipfs://QmTtut2mT8b5SXViEhau6BCcPGtLQJiftNw8GTQheKAgT7/";
      var tokenID = 0;
      var extension = await meemosWorld.baseExtension();

      const newBaseUri = await meemosWorld.setBaseURI(baseURI);
      await newBaseUri.wait();

      expect(await meemosWorld.baseURI()).to.equal(baseURI);
      expect(await meemosWorld.tokenURI(tokenID)).to.equal(baseURI + tokenID + extension);
  });

  it("Set new baseURI", async function () {

      var contractURI = "ipfs://QmYE2pgJqytpavboy4MN5C5fz4v8KkCZv3Qikrfr2ukKPa";

      const newContractUri = await meemosWorld.setContractURI(contractURI);
      await newContractUri.wait();

      expect(await meemosWorld.contractURI()).to.equal(contractURI);
  });

  it("Withdraw $$$", async function () {

      var ownerBalance = await owner.getBalance();

      const withdrawBalance = await meemosWorld.withdraw();
      await withdrawBalance.wait();

      expect(await owner.getBalance()).to.gte(ownerBalance);
  });

  it("Reduce price", async function () {

      const priceBefore = await meemosWorld.price();

      const newPrice = await meemosWorld.setPrice("50000000000000000");
      await newPrice.wait();

      expect(await meemosWorld.price()).to.lt(priceBefore);
  });

});
