// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@ieigen/pedersencommitment/contracts/PedersenCommitment.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Marketplace.sol";
import "./RangeProof.sol";

contract Bucketization is Marketplace, RangeProof {
    using Counters for Counters.Counter;
    Counters.Counter private _orderId;
    Counters.Counter private _pairId;

    PedersenCommitment _pc;

    mapping (address => uint[2]) private _credits;

    struct UnmatchedOrder {
        uint id;
        address account;
        uint rateComm;
        uint BuyOrSell; // 0 BUY, 1 SELL
    }

    address private _marketplaceAccount;

    constructor() {
        _marketplaceAccount = msg.sender;
        _pc = new PedersenCommitment();
        _pc.setH();
    }

    UnmatchedOrder[] private _unmatchedOrders;
    mapping (uint => uint) private _orderIdToOrderIdx;

    mapping (uint => OrderPair) private _matchedPair;
    mapping (address => uint[]) private _buyerAddrToPairIds; //
    mapping (address => uint[]) private _sellerAddrToPairIds;

    // 3.1-3.4
    function submitOrder(address account, uint rateComm, uint kind) public returns(uint) {
        _orderId.increment();
        uint id = _orderId.current();
        _orderIdToOrderIdx[id] = _unmatchedOrders.length;
        _unmatchedOrders.push(UnmatchedOrder(id, account, rateComm, kind));
        return id;
    }

    // 3.10-3.12
    function attachOrderBook(uint id, Bucket memory bucket, uint[2] memory a, uint[2][2] memory b, uint[2] memory c) public {
        UnmatchedOrder memory order = _unmatchedOrders[_orderIdToOrderIdx[id]];
        uint[2] memory input = [bucket.startValue, bucket.startValue + bucket.width];

        // check the bucket including the rateComm
        require(verifyRangeProof(a, b, c, input), "B: Invalid range proof");

        // TODO check the rateComm is exactly from order id

        if (order.BuyOrSell == 0) {
            BuyOrders.push(Order(id, order.account, BuyOrSell.BUY, order.rateComm, bucket));
        } else {
            SellOrders.push(Order(id, order.account, BuyOrSell.BUY, order.rateComm, bucket));
        }
    }

    // 3.14-3.15
    function tradeRound() public {
        Order[] memory sortedSell = sort(SellOrders);
        Order[] memory sortedBuy = sort(BuyOrders);

        OrderPair memory matchedPair = matching(sortedBuy, sortedSell);

        for (uint i = 0; i < matchedPair.length; i ++) {
            _pairId.increment();
            _matchedPair[_pairId.current()] =  matchedPair[i];
            _buyerAddrToPairIds[matchedPair[i].buyOrder.trader].push(_pairId.current());
            _sellerAddrToPairIds[matchedPair[i].sellOrder.trader].push(_pairId.current());
        }
    }

    function findMatchedSeller(uint orderId, address buyerAddr) public view returns (address, uint) {
        for (uint i = 0; i < _buyerAddrToPairIds[buyerAddr].length; i++) {
            uint pairId = _buyerAddrToPairIds[buyerAddr][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.buyOrder.id == orderId) {
                return (op.sellOrder.trader, pairId);
            }
        }
        // to be confirmed
        return (address(0), -1);
    }

    function findMatchedBuyer(uint orderId, address sellerAddr) public view returns (address, uint) {
        for (uint i = 0; i < _sellerAddrToPairIds[sellerAddr].length; i++) {
            uint pairId = _sellerAddrToPairIds[sellerAddr][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.sellOrder.id == orderId) {
                return (op.buyOrder.trader, pairId);
            }
        }
        // to be confirmed
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
    function confirmRound(uint fees, uint proof, uint pairId) public payable {
        address buyer = msg.sender;
        OrderPair memory pair = _matchedPair[pairId];

        // TODO check pair

        uint feeComm = _pc.subCommitment(pair.buyOrder.rateComm, pair.sellOrder.rateComm);
        require(feeComm == proof, "B: Invalid fee comm");
        require(_pc.verify(fees, feeComm), "B: Invalid fee comm");
        debit(pair.buyOrder.trader, pair.buyOrder.rateComm);
        credit(pair.sellOrder.trader, pair.sellOrder.rateComm);
        _marketplaceAccount.transfer(fees);

        delete _matchedPair[pairId];
        uint len = _buyerAddrToPairIds[msg.sender].length - 1;
        for (uint i = 0; i < len; i ++) {
            if (pairId == _buyerAddrToPairIds[msg.sender][i]) {
               _buyerAddrToPairIds[msg.sender][i] = _buyerAddrToPairIds[msg.sender][len];
            }
        }
        _buyerAddrToPairIds[msg.sender].pop();

        len = _sellerAddrToPairIds[msg.sender].length - 1;
        for (uint i = 0; i < len; i ++) {
            if (pairId == _sellerAddrToPairIds[msg.sender][i]) {
               _sellerAddrToPairIds[msg.sender][i] = _sellerAddrToPairIds[msg.sender][len];
            }
        }
        _sellerAddrToPairIds[msg.sender].pop();
    }

    function debit(address trader, uint comm) internal payable {
        _credits[trader] = _pc.subCommitment(_credits[trader], comm);
    }

    function credit(address trader, uint comm) internal payable {
        _credits[trader] = _pc.addCommitment(_credits[trader], comm);
    }
}
