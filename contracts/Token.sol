pragma solidity 0.7.0;

import "./IERC20.sol";
import "./IMintableToken.sol";
import "./IDividends.sol";
import "./SafeMath.sol";

contract Token is IERC20, IMintableToken, IDividends {
    // ------------------------------------------ //
    // ----- BEGIN: DO NOT EDIT THIS SECTION ---- //
    // ------------------------------------------ //
    using SafeMath for uint256;
    uint256 public totalSupply;
    uint256 public decimals = 18;
    string public name = "Test token";
    string public symbol = "TEST";
    mapping(address => uint256) public balanceOf;
    // ------------------------------------------ //
    // ----- END: DO NOT EDIT THIS SECTION ------ //
    // ------------------------------------------ //

    mapping(address => mapping(address => uint256)) private _allowances;

    address[] private _tokenHolders;

    mapping(address => uint256) private _holderIndexes;

    mapping(address => uint256) private _dividends;

    // IERC20

    function allowance(
        address owner,
        address spender
    ) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function transfer(
        address to,
        uint256 value
    ) external override returns (bool) {
        require(to != address(0), "invalid recipient");
        require(balanceOf[msg.sender] >= value, "insufficient balance");

        balanceOf[msg.sender] = balanceOf[msg.sender].sub(value);
        balanceOf[to] = balanceOf[to].add(value);

        _updateHolder(msg.sender);
        _updateHolder(to);

        emit Transfer(msg.sender, to, value);

        return true;
    }

    function approve(
        address spender,
        uint256 value
    ) external override returns (bool) {
        require(spender != address(0), "invalid spender");

        _allowances[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);

        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external override returns (bool) {
        require(from != address(0), "invalid sender");
        require(to != address(0), "invalid recipient");
        require(balanceOf[from] >= value, "insufficient balance");
        require(
            _allowances[from][msg.sender] >= value,
            "insufficient allowance"
        );

        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);

        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(
            value
        );

        _updateHolder(from);
        _updateHolder(to);

        emit Transfer(from, to, value);
        emit Approval(from, msg.sender, _allowances[from][msg.sender]);

        return true;
    }

    // IMintableToken

    function mint() external payable override {
        require(msg.value > 0, "must send ETH");

        balanceOf[msg.sender] = balanceOf[msg.sender].add(msg.value);
        totalSupply = totalSupply.add(msg.value);

        _updateHolder(msg.sender);

        emit Transfer(address(0), msg.sender, msg.value);
    }

    function burn(address payable dest) external override {
        require(dest != address(0), "invalid destination");

        uint256 amount = balanceOf[msg.sender];

        require(amount > 0, "no token balance");

        balanceOf[msg.sender] = 0;
        totalSupply = totalSupply.sub(amount);

        _updateHolder(msg.sender);

        (bool success, ) = dest.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Transfer(msg.sender, address(0), amount);
    }

    // IDividends

    function getNumTokenHolders() external view override returns (uint256) {
        return _tokenHolders.length;
    }

    function getTokenHolder(
        uint256 index
    ) external view override returns (address) {
        require(index > 0 && index <= _tokenHolders.length, "invalid index");

        // Tests use 1-based indexes
        return _tokenHolders[index - 1];
    }

    function recordDividend() external payable override {
        require(msg.value > 0, "must send ETH");
        require(totalSupply > 0, "no token supply");

        // Dividend is calculated using the balance at the
        // exact moment recordDividend() is called.
        for (uint256 i = 0; i < _tokenHolders.length; i++) {
            address holder = _tokenHolders[i];

            uint256 dividend = msg.value.mul(balanceOf[holder]).div(
                totalSupply
            );

            _dividends[holder] = _dividends[holder].add(dividend);
        }
    }

    function getWithdrawableDividend(
        address payee
    ) external view override returns (uint256) {
        return _dividends[payee];
    }

    function withdrawDividend(address payable dest) external override {
        require(dest != address(0), "invalid destination");

        uint256 amount = _dividends[msg.sender];

        require(amount > 0, "no dividend");

        // Clear first to prevent reentrancy
        _dividends[msg.sender] = 0;

        (bool success, ) = dest.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function _updateHolder(address account) internal {
        uint256 balance = balanceOf[account];

        if (balance > 0) {
            // Add if not already in holder list
            if (_holderIndexes[account] == 0) {
                _tokenHolders.push(account);

                // index + 1
                _holderIndexes[account] = _tokenHolders.length;
            }
        } else {
            // Remove if balance became zero
            uint256 indexPlusOne = _holderIndexes[account];

            if (indexPlusOne != 0) {
                uint256 index = indexPlusOne - 1;
                uint256 lastIndex = _tokenHolders.length - 1;

                if (index != lastIndex) {
                    address lastHolder = _tokenHolders[lastIndex];

                    _tokenHolders[index] = lastHolder;
                    _holderIndexes[lastHolder] = index + 1;
                }

                _tokenHolders.pop();
                delete _holderIndexes[account];
            }
        }
    }

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}
