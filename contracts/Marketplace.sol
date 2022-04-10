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
        uint256 rateCommX;
        uint256 rateCommY;
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

    uint DEFAULT_BUCKET_WIDTH = 10;

    function chooseBuckets() public view returns (Bucket[] memory) {
        uint endValue = 100;
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
        uint sellIdx = 0;

        while (buyIdx < buyOrders.length && sellIdx < sellOrders.length) {
            Order memory buyOrder = buyOrders[buyIdx];
            Order memory sellOrder = sellOrders[sellIdx];
            if(buyOrder.bucket.startValue > sellOrder.bucket.startValue) {
                OrderPair memory pair = OrderPair(buyOrder, sellOrder);
                matchedOrders.push(pair);
                buyIdx += 1;
                sellIdx += 1;
            } else {
                buyIdx += 1;
            }
        }
        return matchedOrders;
    }

    function matching1(Order[] memory buyOrders, Order[] memory sellOrders) public returns (OrderPair[] memory) {
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
        quickSort(orderBook, 0, int(orderBook.length - 1));
        return orderBook;
    }
  
    function quickSort(Order[] memory orderBook, int left, int right) internal {
        int i = left;
        int j = right;
        if (i >= j) return;
        
        uint pivot = orderBook[uint(left + (right - left) / 2)].bucket.startValue;
        while (i <= j) {
            while (orderBook[uint(i)].bucket.startValue < pivot) i++;
            while (pivot < orderBook[uint(j)].bucket.startValue) j--;
            if (i <= j) {
                (orderBook[uint(i)], orderBook[uint(j)]) = (orderBook[uint(j)], orderBook[uint(i)]);
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
