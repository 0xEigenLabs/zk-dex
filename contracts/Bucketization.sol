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
    }

    UnmatchedOrder[] private _unmatchedOrders;
    mapping (uint => uint) private _orderIdToOrderIdx;

    mapping (uint => OrderPair) private _matchedPair;
    mapping (address => uint[]) private _pairIdToOrderIdx;

    function submitOrder(address account, uint rateComm, uint kind) public returns(uint) {
        _orderId.increment();
        uint id = _orderId.current();
        _orderIdToOrderIdx[id] = _unmatchedOrders.length;
        _unmatchedOrders.push(UnmatchedOrder(id, account, rateComm, kind));
        return id;
    }

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

    function tradeRound() public {
        Order[] memory sortedSell = sort(SellOrders);
        Order[] memory sortedBuy = sort(BuyOrders);

        OrderPair memory matchedPair = matching(sortedBuy, sortedSell);

        for (var i = 0; i < matchedPair.length; i ++) {
            _pairId.increment();
            _matchedPair[_pairId.current()] =  _matchedPair[i];
            _pairIdToOrderIdx[_matchedPair[i].buyOrder.trader].push(_pairId.current());
        }
    }

    public findPair(address seller) public view (returns uint) {
        for (var i = 0; i < _pairIdToOrderIdx[msg.sender].length; i ++) {
            uint pairId = _pairIdToOrderIdx[msg.sender][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.sellOrder.trader == seller) {
                return pairId;
            }
            // doesn't not match ever
            return 0;
        }
    }

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
        uint len = _pairIdToOrderIdx[msg.sender],length - 1;
        for (var i = 0; i < len; i ++) {
            if (pairId == _pairIdToOrderIdx[msg.sender][i]) {
               _pairIdToOrderIdx[msg.sender][i] = _pairIdToOrderIdx[msg.sender][len];
            }
        }
        _pairIdToOrderIdx[msg.sender].pop();
    }

    function debit(address trader, uint comm) internal payable {
        _credits[trader] = _pc.subCommitment(_credits[trader], comm);
    }

    function credit(address trader, uint comm) internal payable {
        _credits[trader] = _pc.addCommitment(_credits[trader], comm);
    }
}
