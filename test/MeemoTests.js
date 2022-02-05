const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const hre = require("hardhat");

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
  let sosContract;
  let whitelist;
  let leafNodes;
  let merkleTree;
  let rootHash;
  let sosWhaleWallet1;
  let sosWhaleWallet2;

  before(async function() {
      const MeemosWorld = await ethers.getContractFactory("MeemosWorld");
      meemosWorld = await MeemosWorld.deploy();
      await meemosWorld.deployed();

      // sosContract = new ethers.Contract("0x3b484b82567a09e2588A13D54D032153f0c0aEe0", [
      //   "function approve(address spender, uint256 amount) external returns (bool)",
      //   "function balanceOf(address account) external view returns (uint256)",
      //   "function allowance(address owner, address spender) external view returns (uint256)"
      // ], hre.ethers.provider);

      [owner, wallet1, wallet2, wallet3, wallet4, sosWhaleWallet1, sosWhaleWallet2] = await ethers.getSigners();

      const OpenDAO = await ethers.getContractFactory("OpenDAO");
      sosContract = await OpenDAO.deploy("SOS", "SOS", [sosWhaleWallet1.address, sosWhaleWallet2.address]);
      await sosContract.deployed();

      var setSOSContract = await meemosWorld.setSOSContract(sosContract.address);
      await setSOSContract.wait();

      whitelist = [
          wallet1.address,
          wallet2.address,
          wallet3.address,
          sosWhaleWallet1.address
      ]
      leafNodes = whitelist.map(addr => keccak256(addr));
      merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
      rootHash = ethers.utils.defaultAbiCoder.encode(['bytes32'], [merkleTree.getRoot()]);

      console.log('Whitelist Merkle Tree\n', merkleTree.toString());
      console.log('Root Hash:', rootHash);
  });

  it("Airdrop for devs", async function () {

      // Expects to distribute 100 mints to devs
      const airdropMint1 = await meemosWorld.reservedDevsMint(100, owner.address);
      await airdropMint1.wait();

      expect(await meemosWorld.balanceOf(owner.address)).to.equal(100);
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
      await expect(wallet1Connect.whitelistMint(1, true, proofWallet1, {value: price})).to.be.revertedWith("Whitelist sale not active");

      // Activate whitelist
      const toggleWhitelistSale = await meemosWorld.setWhitelistSale(true);
      await toggleWhitelistSale.wait();

      // Fail 0 mints
      await expect(wallet1Connect.whitelistMint(0, true, proofWallet1, {value: 0})).to.be.revertedWith("No 0 mints");
      // Fail 3 mints
      await expect(wallet1Connect.whitelistMint(3, true, proofWallet1, {value: price.mul(3)})).to.be.revertedWith("Excess max per whitelist tx");
      // Fail bad price
      await expect(wallet1Connect.whitelistMint(1, true, proofWallet1, {value: price.add(1)})).to.be.revertedWith("Invalid funds provided");

      // Mint 1 and 1
      var mintWhitelist1 = await wallet1Connect.whitelistMint(1, true, proofWallet1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(1);

      mintWhitelist1 = await wallet1Connect.whitelistMint(1, true, proofWallet1, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(2);

      // Mint 2
      var proofWallet2 = arrayProofMerkletTree(merkleTree, wallet2.address);
      var mintWhitelist2 = await wallet2Connect.whitelistMint(2, true, proofWallet2, {value: price.mul(2)});
      await mintWhitelist2.wait();

      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(2);

      // Fail invalid merkle proof
      await expect(wallet3Connect.whitelistMint(2, true, proofWallet2, {value: price.mul(2)})).to.be.revertedWith("Invalid proof");

      // Mint 2
      var proofWallet3 = arrayProofMerkletTree(merkleTree, wallet3.address);
      var mintWhitelist3 = await wallet3Connect.whitelistMint(2, true, proofWallet3, {value: price.mul(2)});
      await mintWhitelist3.wait();

      expect(await meemosWorld.balanceOf(wallet3.address)).to.equal(2);
      // Fail Max mints per whitelist wallet 1
      await expect(wallet3Connect.whitelistMint(1, true, proofWallet3, {value: price})).to.be.revertedWith("Max mints per whitelist wallet");
      // Fail Max mints per whitelist wallet 2
      await expect(wallet3Connect.whitelistMint(2, true, proofWallet3, {value: price.mul(2)})).to.be.revertedWith("Max mints per whitelist wallet");
  });

  it("Public mint", async function () {

      const wallet1Connect = await meemosWorld.connect(wallet1);
      const wallet2Connect = await meemosWorld.connect(wallet2);
      const wallet3Connect = await meemosWorld.connect(wallet3);
      const wallet4Connect = await meemosWorld.connect(wallet4);
      const price = await meemosWorld.price();

      // Fail because public not active
      await expect(wallet1Connect.mint(1, true, {value: price})).to.be.revertedWith("Public sale not active");

      // Deactivate whitelist
      const toggleWhitelistSale = await meemosWorld.setWhitelistSale(false);
      await toggleWhitelistSale.wait();

      // Activate public
      const togglePublicSale = await meemosWorld.setPublicSale(true);
      await togglePublicSale.wait();

      // Fail 0 mints
      await expect(wallet1Connect.mint(0, true, {value: 0})).to.be.revertedWith("No 0 mints");
      // Fail 6 mints
      await expect(wallet1Connect.mint(6, true, {value: price.mul(6)})).to.be.revertedWith("Excess max per public tx");
      // Fail bad price
      await expect(wallet1Connect.mint(1, true, {value: price.add(1)})).to.be.revertedWith("Invalid funds provided");

      // Mint 3 in 1
      var mintWhitelist1 = await wallet1Connect.mint(1, true, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(3);

      var mintWhitelist1 = await wallet1Connect.mint(1, true, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(4);

      var mintWhitelist1 = await wallet1Connect.mint(1, true, {value: price});
      await mintWhitelist1.wait();

      expect(await meemosWorld.balanceOf(wallet1.address)).to.equal(5);

      // Mint 3
      var mintWhitelist2 = await wallet2Connect.mint(3, true, {value: price.mul(3)});
      await mintWhitelist2.wait();

      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(5);

      // Mint 3
      var mintWhitelist3 = await wallet3Connect.mint(3, true, {value: price.mul(3)});
      await mintWhitelist3.wait();

      expect(await meemosWorld.balanceOf(wallet2.address)).to.equal(5);

      // Mint 5
      var mintWhitelist4 = await wallet4Connect.mint(5, true, {value: price.mul(5)});
      await mintWhitelist4.wait();

      expect(await meemosWorld.balanceOf(wallet4.address)).to.equal(5);

      // Fail Max mints per wallet 1
      await expect(wallet1Connect.mint(1, true, {value: price})).to.be.revertedWith("Max mints per wallet");
      // Fail Max mints per wallet 5
      await expect(wallet4Connect.mint(5, true, {value: price.mul(5)})).to.be.revertedWith("Max mints per wallet");
  });

  it("Mint with $SOS", async function () {

      // Deactivate public
      var togglePublicSale = await meemosWorld.setPublicSale(false);
      await togglePublicSale.wait();

      // Activate whitelist
      var toggleWhitelistSale = await meemosWorld.setWhitelistSale(true);
      await toggleWhitelistSale.wait();

      var sosWhaleWallet1Balance = await sosContract.balanceOf(sosWhaleWallet1.address);
      var sosWhaleWallet2Balance = await sosContract.balanceOf(sosWhaleWallet2.address);
      const sosWalletContract1 = await sosContract.connect(sosWhaleWallet1);
      const sosWalletContract2 = await sosContract.connect(sosWhaleWallet2);
      const sosWallet1 = await meemosWorld.connect(sosWhaleWallet1);
      const sosWallet2 = await meemosWorld.connect(sosWhaleWallet2);
      const sosPrice = await meemosWorld.sos_price();

      // Aproving SOS for contract
      var approvingSOS = await sosWalletContract1.approve(meemosWorld.address, sosPrice.mul(2));
      await approvingSOS.wait();
      expect(await sosWalletContract1.allowance(sosWhaleWallet1.address, meemosWorld.address)).to.equal(sosPrice.mul(2));

      // Mint 2 whitelist with SOS
      var proof = arrayProofMerkletTree(merkleTree, sosWhaleWallet1.address);
      var mintWhitelist = await sosWallet1.whitelistMint(2, false, proof);
      await mintWhitelist.wait();

      expect(await meemosWorld.balanceOf(sosWhaleWallet1.address)).to.equal(2);
      expect(await sosContract.balanceOf(sosWhaleWallet1.address)).to.equal(sosWhaleWallet1Balance.sub(sosPrice.mul(2)));

      // Deactivate whitelist
      toggleWhitelistSale = await meemosWorld.setWhitelistSale(false);
      await toggleWhitelistSale.wait();

      // Activate public
      togglePublicSale = await meemosWorld.setPublicSale(true);
      await togglePublicSale.wait();

      // Aproving SOS for contract
      var approvingSOS2 = await sosWalletContract1.approve(meemosWorld.address, sosPrice.mul(3));
      await approvingSOS2.wait();
      expect(await sosWalletContract1.allowance(sosWhaleWallet1.address, meemosWorld.address)).to.equal(sosPrice.mul(3));

      // Mint 3 whitelist with SOS
      var mintPublic = await sosWallet1.mint(3, false);
      await mintPublic.wait();

      expect(await meemosWorld.balanceOf(sosWhaleWallet1.address)).to.equal(5);
      expect(await sosContract.balanceOf(sosWhaleWallet1.address)).to.equal(sosWhaleWallet1Balance.sub(sosPrice.mul(5)));

      // Aproving SOS for contract
      var approvingSOS3 = await sosWalletContract2.approve(meemosWorld.address, sosPrice.mul(5));
      await approvingSOS3.wait();
      expect(await sosWalletContract2.allowance(sosWhaleWallet2.address, meemosWorld.address)).to.equal(sosPrice.mul(5));

      // Mint 5 whitelist with SOS
      var mintPublic2 = await sosWallet2.mint(5, false);
      await mintPublic2.wait();

      expect(await meemosWorld.balanceOf(sosWhaleWallet2.address)).to.equal(5);
      expect(await sosContract.balanceOf(sosWhaleWallet2.address)).to.equal(sosWhaleWallet2Balance.sub(sosPrice.mul(5)));
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

  it("Set new contractURI", async function () {

      var contractURI = "ipfs://QmYE2pgJqytpavboy4MN5C5fz4v8KkCZv3Qikrfr2ukKPa";

      const newContractUri = await meemosWorld.setContractURI(contractURI);
      await newContractUri.wait();

      expect(await meemosWorld.contractURI()).to.equal(contractURI);
  });

  it("Withdraw $$$", async function () {

      var ownerBalance = await owner.getBalance();

      const withdrawBalance = await meemosWorld.withdraw();
      await withdrawBalance.wait();

      expect(await owner.getBalance()).to.gt(ownerBalance);
  });

  it("Withdraw $SOS", async function () {

      var ownerBalance = await sosContract.balanceOf(owner.address);

      const withdrawBalance = await meemosWorld.withdrawToken(sosContract.address);
      await withdrawBalance.wait();

      expect(await sosContract.balanceOf(owner.address)).to.gt(ownerBalance);
  });

  it("Reduce ETH price", async function () {

      const priceBefore = await meemosWorld.price();
      const changePriceTo = ethers.utils.parseUnits("0.05", 18);

      const newPrice = await meemosWorld.setPrice(changePriceTo);
      await newPrice.wait();

      expect(await meemosWorld.price()).to.lt(priceBefore);
      expect(await meemosWorld.price()).to.eq(changePriceTo);
  });

  it("Reduce $SOS price", async function () {

      const priceBefore = await meemosWorld.sos_price();
      const changePriceTo = ethers.utils.parseUnits("100000000", 18);

      const newPrice = await meemosWorld.setSOSPrice(changePriceTo);
      await newPrice.wait();

      expect(await meemosWorld.sos_price()).to.lt(priceBefore);
      expect(await meemosWorld.sos_price()).to.eq(changePriceTo);
  });

  it("Reduce max supply", async function () {

      // Deactivate whitelist
      const toggleWhitelistSale = await meemosWorld.setWhitelistSale(false);
      await toggleWhitelistSale.wait();

      // Activate public
      const togglePublicSale = await meemosWorld.setPublicSale(true);
      await togglePublicSale.wait();

      const wallet1Connect = await meemosWorld.connect(wallet1);
      const price = await meemosWorld.price();

      // Reduce total supply
      const reduceSupply = await meemosWorld.reduceSupply(await meemosWorld.totalSupply());
      await reduceSupply.wait();

      // Fail max supply trying to mint
      await expect(wallet1Connect.mint(1, true, {value: price})).to.be.revertedWith("Exceeds max supply");
  });

});
