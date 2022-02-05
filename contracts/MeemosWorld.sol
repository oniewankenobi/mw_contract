// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ERC721A.sol";
//import "hardhat/console.sol";

/**
$$\      $$\                                           $$\               $$\      $$\                     $$\       $$\
$$$\    $$$ |                                          $  |              $$ | $\  $$ |                    $$ |      $$ |
$$$$\  $$$$ | $$$$$$\   $$$$$$\  $$$$$$\$$$$\   $$$$$$\\_/$$$$$$$\       $$ |$$$\ $$ | $$$$$$\   $$$$$$\  $$ | $$$$$$$ |
$$\$$\$$ $$ |$$  __$$\ $$  __$$\ $$  _$$  _$$\ $$  __$$\ $$  _____|      $$ $$ $$\$$ |$$  __$$\ $$  __$$\ $$ |$$  __$$ |
$$ \$$$  $$ |$$$$$$$$ |$$$$$$$$ |$$ / $$ / $$ |$$ /  $$ |\$$$$$$\        $$$$  _$$$$ |$$ /  $$ |$$ |  \__|$$ |$$ /  $$ |
$$ |\$  /$$ |$$   ____|$$   ____|$$ | $$ | $$ |$$ |  $$ | \____$$\       $$$  / \$$$ |$$ |  $$ |$$ |      $$ |$$ |  $$ |
$$ | \_/ $$ |\$$$$$$$\ \$$$$$$$\ $$ | $$ | $$ |\$$$$$$  |$$$$$$$  |      $$  /   \$$ |\$$$$$$  |$$ |      $$ |\$$$$$$$ |
\__|     \__| \_______| \_______|\__| \__| \__| \______/ \_______/       \__/     \__| \______/ \__|      \__| \_______|
**/

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract MeemosWorld is ERC721A, Ownable {

    string public baseURI = "ipfs://QmTtut2mT8b5SXViEhau6BCcPGtLQJiftNw8GTQheKAgT7/";
    string public contractURI = "ipfs://QmYE2pgJqytpavboy4MN5C5fz4v8KkCZv3Qikrfr2ukKPa";
    string public constant baseExtension = ".json";
    bytes32 public merkleRoot = 0x359df92a166631e5604eea4ec89a40b207a353a6d2bf2fd88f2fef3491bbc4e2;
    // Mainnet - 0xa5409ec958C83C3f309868babACA7c86DCB077c1
    // Rinkeby - 0xF57B2c51dED3A29e6891aba85459d600256Cf317
    address public constant proxyRegistryAddress = 0xa5409ec958C83C3f309868babACA7c86DCB077c1;

    // Testing purposes - delete before deploy
    IERC20 public SOSContract = IERC20(0x3b484b82567a09e2588A13D54D032153f0c0aEe0);
    // Production
    //IERC20 public constant SOSContract = IERC20(0x3b484b82567a09e2588A13D54D032153f0c0aEe0);

    uint256 public MAX_SUPPLY = 8888;

    uint256 public constant MAX_PER_TX_WL = 2;
    uint256 public constant MAX_PER_TX_PUBLIC = 5;
    uint256 public constant MAX_PER_WALLET = 5;
    uint256 public price = 0.06 ether;
    uint256 public sos_price = 500000000 ether;
    uint256 public DEVS_AIRDROP = 100;

    bool public whiteListSale = false;
    bool public publicSale = false;

    constructor() ERC721A("MeemosWorld", "MW") {}

    function mint(uint256 _amount, bool _mintWithEther) external payable {
        address _caller = _msgSender();
        require(publicSale == true && whiteListSale == false, "Public sale not active");
        require(MAX_SUPPLY >= totalSupply() + _amount, "Exceeds max supply");
        require(_amount > 0, "No 0 mints");
        require(tx.origin == _caller, "No contracts");
        require(MAX_PER_TX_PUBLIC >= _amount , "Excess max per public tx");
        require(MAX_PER_WALLET >= _numberMinted(_caller) + _amount, "Max mints per wallet");

        if(_mintWithEther){
            require(_amount * price == msg.value, "Invalid funds provided");
        }else{
            require(SOSContract.transferFrom(_caller, address(this), _amount * sos_price), "Invalid sos funds provided");
        }

        _safeMint(_caller, _amount);
    }

    function whitelistMint(uint256 _amount, bool _mintWithEther, bytes32[] calldata _merkleProof) external payable {
        address _caller = _msgSender();
        require(whiteListSale == true, "Whitelist sale not active");
        require(MAX_SUPPLY >= totalSupply() + _amount, "Exceeds max supply");
        require(_amount > 0, "No 0 mints");
        require(tx.origin == _caller, "No contracts");
        require(MAX_PER_TX_WL >= _amount , "Excess max per whitelist tx");
        require(MAX_PER_TX_WL >= _numberMinted(_caller) + _amount, "Max mints per whitelist wallet");

        if(_mintWithEther){
            require(_amount * price == msg.value, "Invalid funds provided");
        }else{
            require(SOSContract.transferFrom(_caller, address(this), _amount * sos_price), "Invalid sos funds provided");
        }

        bytes32 leaf = keccak256(abi.encodePacked(_caller));
        require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Invalid proof");

        _safeMint(_caller, _amount);
    }

    function reservedDevsMint(uint256 _amount, address _to) external onlyOwner {
        require(DEVS_AIRDROP >= _amount, "Exceeds airdrop for devs");
        DEVS_AIRDROP -= _amount;
        _safeMint(_to, _amount);
    }

    function isApprovedForAll(address owner, address operator)
        override
        public
        view
        returns (bool)
    {
        // Whitelist OpenSea proxy contract for easy trading.
        ProxyRegistry proxyRegistry = ProxyRegistry(proxyRegistryAddress);
        if (address(proxyRegistry.proxies(owner)) == operator) {
            return true;
        }

        return super.isApprovedForAll(owner, operator);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = _msgSender().call{value: balance}("");
        require(success, "Failed to send");
    }

    function withdrawToken(IERC20 token) external onlyOwner {
        uint256 funds = token.balanceOf(address(this));
        require(funds > 0, "No balance token");
        token.transfer(_msgSender(), funds);
    }

    function reduceSupply(uint256 _MAX_SUPPLY) external onlyOwner {
        require(_MAX_SUPPLY >= totalSupply(), "Error reducing supply");
        MAX_SUPPLY = _MAX_SUPPLY;
    }

    function setRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function setPublicSale(bool _state) external onlyOwner {
        publicSale = _state;
    }

    function setWhitelistSale(bool _state) external onlyOwner {
        whiteListSale = _state;
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        baseURI = baseURI_;
    }

    function setContractURI(string memory _contractURI) external onlyOwner {
        contractURI = _contractURI;
    }

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    function setSOSPrice(uint256 _price) external onlyOwner {
        sos_price = _price;
    }

    function walletMints(address owner) public view returns(uint256) {
       return _numberMinted(owner);
    }

    // For testing purposes - delete before deploying
    function setSOSContract(IERC20 _sosContract) external onlyOwner {
        SOSContract = _sosContract;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), "Token does not exist.");
        return bytes(baseURI).length > 0 ? string(
            abi.encodePacked(
              baseURI,
              Strings.toString(_tokenId),
              baseExtension
            )
        ) : "";
    }
}

contract OwnableDelegateProxy { }
contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}
