// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// solhint-disable quotes

import "forge-std/Vm.sol";

library JsonWriter {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct File {
        string path;
        bool overwrite;
    }

    struct Buffer {
        bytes contents;
    }

    function newBuffer() internal pure returns (Buffer memory) {
        return Buffer(new bytes(0));
    }

    function nextIndent(string memory indent)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked("  ", indent));
    }

    function write(
        Buffer memory buffer,
        bytes memory blob,
        bool line
    ) internal pure {
        buffer.contents = abi.encodePacked(
            buffer.contents,
            blob,
            line ? "\n" : ""
        );
    }

    function write(Buffer memory buffer, bytes memory blob) internal pure {
        write(buffer, blob, false);
    }

    function write(Buffer memory buffer, string memory blob) internal pure {
        write(buffer, bytes(blob));
    }

    function writeLine(Buffer memory buffer, bytes memory line) internal pure {
        write(buffer, line, true);
    }

    function writeLine(Buffer memory buffer, string memory line) internal pure {
        writeLine(buffer, bytes(line));
    }

    function writeLine(
        Buffer memory buffer,
        string memory indent,
        string memory line
    ) internal pure {
        writeLine(buffer, abi.encodePacked(indent, line));
    }

    function writeKv(
        Buffer memory buffer,
        string memory indent,
        string memory key,
        string memory value,
        bool terminal
    ) internal pure {
        string memory comma = terminal ? "" : ",";
        bytes memory line = abi.encodePacked(
            '"',
            key,
            '": "',
            value,
            '"',
            comma
        );
        writeLine(buffer, indent, string(line));
    }

    function writeArrayOpen(
        Buffer memory buffer,
        string memory indent,
        string memory key
    ) internal pure {
        bytes memory line = abi.encodePacked('"', key, '": [');
        writeLine(buffer, indent, string(line));
    }

    function writeArrayClose(
        Buffer memory buffer,
        string memory indent,
        bool terminal
    ) internal pure {
        writeLine(buffer, indent, terminal ? "]" : "],");
    }

    function writeObjectOpen(Buffer memory buffer, string memory indent)
        internal
        pure
    {
        writeLine(buffer, indent, "{");
    }

    function writeObjectOpen(
        Buffer memory buffer,
        string memory indent,
        string memory name
    ) internal pure {
        if (bytes(name).length == 0) {
            writeObjectOpen(buffer, indent);
            return;
        }
        string memory line = string(abi.encodePacked('"', name, '": {'));
        writeLine(buffer, indent, line);
    }

    function writeObjectClose(
        Buffer memory buffer,
        string memory indent,
        bool terminal
    ) internal pure {
        writeLine(buffer, indent, terminal ? "}" : "},");
    }

    function writeObjectBody(
        Buffer memory buffer,
        string memory indent,
        string[2][] memory kvs
    ) internal pure {
        for (uint256 i = 0; i < kvs.length; i++) {
            writeKv(buffer, indent, kvs[i][0], kvs[i][1], i == kvs.length - 1);
        }
    }

    function writeSimpleObject(
        Buffer memory buffer,
        string memory indent,
        string memory name,
        string[2][] memory kvs,
        bool terminal
    ) internal pure {
        writeObjectOpen(buffer, indent, name);
        writeObjectBody(buffer, nextIndent(indent), kvs);
        writeObjectClose(buffer, indent, terminal);
    }

    function flushTo(Buffer memory buffer, File memory file) internal {
        if (file.overwrite) {
            vm.writeFile(file.path, string(buffer.contents));
        } else {
            vm.writeLine(file.path, string(buffer.contents));
        }
    }
}
