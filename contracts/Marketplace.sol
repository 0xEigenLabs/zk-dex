// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Marketplace {
    using SafeMath for uint;

    enum BuyOrSell {
        BUY,
        SELL
    }

    struct Order {
        uint id;
        address trader;
        uint buyOrSell; // 0 BUY, 1 SELL
        uint rateComm;
        Bucket bucket;
    }

    Order[] BuyOrders;
    Order[] SellOrders;


    struct Bucket {
        uint startValue;
        uint width;
        uint id;
    }

    struct OrderPair {
        Order buyOrder;
        Order sellOrder;
    }

    OrderPair[] private matchedOrders;

    uint DEFAULT_BUCKET_WIDTH = 1000;

    function chooseBuckets() public view returns (Bucket[] memory) {
        uint endValue = 10000;
        uint startValue = 0;
        uint bucketCount = endValue.sub(startValue).div(DEFAULT_BUCKET_WIDTH).add(1);
        Bucket[] memory buckets = new Bucket[](bucketCount);
        for (uint i = 0; i < buckets.length; i++) {
            buckets[i] = Bucket(startValue + i * DEFAULT_BUCKET_WIDTH, DEFAULT_BUCKET_WIDTH, i); 
        }
        return buckets;
    }

    function matching(Order[] memory buyOrders, Order[] memory sellOrders) public returns (OrderPair[] memory) {
        uint buyIdx = 0;
        uint sellIdx = sellOrders.length - 1;

        while (buyIdx < buyOrders.length && sellIdx >= 0) {
            Order memory buyOrder = buyOrders[buyIdx];
            Order memory sellOrder = sellOrders[sellIdx];
            if(buyOrder.bucket.startValue > sellOrder.bucket.startValue) {
                OrderPair memory pair = OrderPair(buyOrder, sellOrder);
                matchedOrders.push(pair);
                buyIdx += 1;
                sellIdx -= 1;
            } else {
                buyIdx += 1;
            }
        }
        return matchedOrders;
    }

    function sort(Order[] memory orderBook) public returns (Order[] memory) {
        quickSort(orderBook, 0, orderBook.length);
        return orderBook;
    }
  
    function quickSort(Order[] memory orderBook, uint left, uint right) internal {
        uint i = left;
        uint j = right;
        if (i == j) return;
        
        uint pivot = orderBook[left + (right - left) / 2].bucket.startValue;
        while (i <= j) {
            while (orderBook[i].bucket.startValue < pivot) i++;
            while (pivot < orderBook[j].bucket.startValue) j--;
            if (i <= j) {
                (orderBook[i], orderBook[j]) = (orderBook[j], orderBook[i]);
                i++;
                j--;
            }
        }
        if (left < j)
            quickSort(orderBook, left, j);
        if (i < right)
            quickSort(orderBook, i, right);
    }
}
