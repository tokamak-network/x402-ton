// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {TonPaymentFacilitator} from "../src/TonPaymentFacilitator.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        TonPaymentFacilitator facilitator = new TonPaymentFacilitator();
        console.log("TonPaymentFacilitator:", address(facilitator));
        vm.stopBroadcast();
    }
}
