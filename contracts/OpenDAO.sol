// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC20.sol";

contract OpenDAO is ERC20 {
    uint256 public constant MAX_SUPPLY = uint248(1e14 ether);
    uint256 public constant SPLIT_MINT = MAX_SUPPLY / 100 * 50;

    constructor(string memory _name, string memory _symbol, address[] memory testAddreses) ERC20(_name, _symbol) {
        _mint(testAddreses[0], SPLIT_MINT);
        _mint(testAddreses[1], SPLIT_MINT);
        _totalSupply = MAX_SUPPLY;
    }
}
