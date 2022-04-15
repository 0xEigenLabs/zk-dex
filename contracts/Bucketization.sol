// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@ieigen/anonmisc/contracts/PedersenCommitmentBabyJubjub.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Marketplace.sol";
import "./pedersen_comm_babyjubjub_verifier.sol";
import "./range_proof_verifier.sol";

contract Bucketization is Marketplace {
    using Counters for Counters.Counter;
    Counters.Counter private _orderId;
    Counters.Counter private _pairId;

    PedersenCommitmentBabyJubjub _pc;
    PedersenCommBabyJubjubVerifier _pcVerifier;
    RangeProofVerifier _rfVerifier;

    uint256 constant private restrictedDealCount = 1;

    mapping (address => uint256[3]) private _credits; // array[0] => r || array[1] => X || array[2] => Y
    mapping (address => uint256) private _dealTimes;

    struct UnmatchedOrder {
        uint id;
        address account;
        uint256 rateCommX;
        uint256 rateCommY;
        uint buyOrSell; // 0 BUY, 1 SELL
    }

    address payable private _marketplaceAccount;

    constructor(/*address payable marketplaceAccount*/) {
        // _marketplaceAccount = marketplaceAccount; // to be comfired
        _pc = new PedersenCommitmentBabyJubjub();
        _pc.setH();
        _pcVerifier = new PedersenCommBabyJubjubVerifier();
        _rfVerifier = new RangeProofVerifier();
    }

    UnmatchedOrder[] private _unmatchedOrders;
    mapping (uint => uint) private _orderIdToOrderIdx;

    mapping (uint => OrderPair) private _matchedPair;
    mapping (address => uint[]) private _buyerAddrToPairIds; //
    mapping (address => uint[]) private _sellerAddrToPairIds;

    function transferToMarketplace() payable public {
        payable(address(this)).transfer(msg.value);
    }
    
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    fallback() external payable {}
    
    receive() external payable {}


    function deposit(address account, uint256 r, uint256 commX, uint256 commY) public {
        if (_credits[account][0] == 0 && _credits[account][1] == 0 && _credits[account][2] == 0) {
            _credits[account][0] = r;
            _credits[account][1] = commX;
            _credits[account][2] = commY;
        } else {
            (_credits[account][0], _credits[account][1], _credits[account][2]) = _pc.addCommitment(_credits[account][0], _credits[account][1], _credits[account][2], r, commX, commY);
        }
    }

    function withdraw(address trader, uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[2] memory input, uint v) public payable {
        //require(msg.sender == trader, "B: invalid withdraw address");
        // Restrict users to withdraw cash after a certain number of deal.
        require(_dealTimes[trader] >= restrictedDealCount, "B: not enough deal time");
        require(_pcVerifier.verifyProof(a, b, c, input), "B: invalid pedersen comm");
        require(_credits[trader][1] > 0 && _credits[trader][2] > 0, "B: account has no assets");
        (bool success, ) = trader.call{value: v}("");
        require(success, "Transfer failed.");
        delete _credits[trader];
    }

    // 3.1-3.4
    function submitOrder(address account, uint256 rateCommX, uint256 rateCommY, uint kind) public returns(uint) {
        _orderId.increment();
        uint256 id = _orderId.current();
        _orderIdToOrderIdx[id] = _unmatchedOrders.length;
        _unmatchedOrders.push(UnmatchedOrder(id, account, rateCommX, rateCommY, kind));
        return uint(id);
    }

    // 3.10-3.12
    function attachOrderBook(uint id, Bucket memory bucket,
                             uint[2] memory a, uint[2][2] memory b, uint[2] memory c) public {
        UnmatchedOrder memory order = _unmatchedOrders[_orderIdToOrderIdx[id]];
        uint[2] memory input = [bucket.startValue, bucket.startValue + bucket.width];

        // check the bucket including the rateComm
        require(_rfVerifier.verifyProof(a, b, c, input), "B: Invalid range proof");

        // TODO check the rateComm is exactly from order id

        if (order.buyOrSell == 0) {
            BuyOrders.push(Order(id, order.account, 0, order.rateCommX, order.rateCommY, bucket));
        } else {
            SellOrders.push(Order(id, order.account, 1, order.rateCommX, order.rateCommY, bucket));
        }
    }

    // 3.14-3.15
    function tradeRound() public {
        Order[] memory sortedSell = sort(SellOrders);
        Order[] memory sortedBuy = sort(BuyOrders);

        OrderPair[] memory matchedPair = matching(sortedBuy, sortedSell);

        for (uint i = 0; i < matchedPair.length; i ++) {
            _pairId.increment();
            _matchedPair[_pairId.current()] =  matchedPair[i];
            _buyerAddrToPairIds[matchedPair[i].buyOrder.trader].push(_pairId.current());
            _sellerAddrToPairIds[matchedPair[i].sellOrder.trader].push(_pairId.current());
            // TODO pop the matched buy orders and sell orders
        }
    }

    function findMatchedSeller(uint orderId, address buyerAddr) public view returns (address, int) {
        for (uint i = 0; i < _buyerAddrToPairIds[buyerAddr].length; i++) {
            uint pairId = _buyerAddrToPairIds[buyerAddr][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.buyOrder.id == orderId) {
                return (op.sellOrder.trader, int(pairId));
            }
        }
        // find nothing
        return (address(0), -1);
    }

    function findMatchedBuyer(uint orderId, address sellerAddr) public view returns (address, int) {
        for (uint i = 0; i < _sellerAddrToPairIds[sellerAddr].length; i++) {
            uint pairId = _sellerAddrToPairIds[sellerAddr][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.sellOrder.id == orderId) {
                return (op.buyOrder.trader, int(pairId));
            }
        }
        // find nothing
        return (address(0), -1);
    }

    function findPair(address seller) public view returns (uint) {
        for (uint i = 0; i < _buyerAddrToPairIds[msg.sender].length; i ++) {
            uint pairId = _buyerAddrToPairIds[msg.sender][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.sellOrder.trader == seller) {
                return pairId;
            }
        }
        // doesn't not match ever
        return 0;
    }

    // 3.17-3.22
    function confirmRound(uint256 r1, uint256 r2, uint256 fees, uint256 proofX, uint256 proofY, uint pairId, uint256 hx, uint256 hy) public payable {
        OrderPair memory pair = _matchedPair[pairId];

        // TODO check pair

        uint256 r3;
        uint256 feeCommX;
        uint256 feeCommY;
        (r3, feeCommX, feeCommY) = _pc.subCommitment(r1, pair.buyOrder.rateCommX, pair.buyOrder.rateCommY, r2, pair.sellOrder.rateCommX, pair.sellOrder.rateCommY);
        require(feeCommX == proofX && feeCommY == proofY, "B: Invalid fee comm");
        require(_pc.verifyWithH(r3, fees, feeCommX, feeCommY, hx, hy), "B: Verify commitment failed");
        debit(pair.buyOrder.trader, r1, pair.buyOrder.rateCommX, pair.buyOrder.rateCommY);
        credit(pair.sellOrder.trader, r2, pair.sellOrder.rateCommX, pair.sellOrder.rateCommY);
        _dealTimes[pair.buyOrder.trader] += 1;
        _dealTimes[pair.sellOrder.trader] += 1;
        
        // TODO marketplace account receive fees
        // _marketplaceAccount.transfer(fees);

        delete _matchedPair[pairId];
        uint len = _buyerAddrToPairIds[pair.buyOrder.trader].length - 1;
        for (uint i = 0; i < len; i ++) {
            if (pairId == _buyerAddrToPairIds[pair.buyOrder.trader][i]) {
               _buyerAddrToPairIds[pair.buyOrder.trader][i] = _buyerAddrToPairIds[pair.buyOrder.trader][len];
            }
        }
        _buyerAddrToPairIds[pair.buyOrder.trader].pop();

        len = _sellerAddrToPairIds[pair.sellOrder.trader].length - 1;
        for (uint i = 0; i < len; i ++) {
            if (pairId == _sellerAddrToPairIds[pair.sellOrder.trader][i]) {
               _sellerAddrToPairIds[pair.sellOrder.trader][i] = _sellerAddrToPairIds[pair.sellOrder.trader][len];
            }
        }
        _sellerAddrToPairIds[pair.sellOrder.trader].pop();
    }

    function debit(address trader, uint256 r, uint256 commX, uint256 commY) internal {
        (_credits[trader][0], _credits[trader][1], _credits[trader][2]) = _pc.subCommitment(_credits[trader][0], _credits[trader][1], _credits[trader][2], r, commX, commY);
    }

    function credit(address trader, uint256 r, uint256 commX, uint256 commY) internal {
        (_credits[trader][0], _credits[trader][1], _credits[trader][2]) = _pc.addCommitment(_credits[trader][0], _credits[trader][1], _credits[trader][2], r, commX, commY);
    }
}
