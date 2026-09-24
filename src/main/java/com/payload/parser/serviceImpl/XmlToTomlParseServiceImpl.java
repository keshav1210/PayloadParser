package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class XmlToTomlParseServiceImpl implements ParserService {
    private static final XmlMapper xmlMapper = new XmlMapper();

    @Override
    public Response parse(Request request) {
        try {
            JsonNode root = xmlMapper.readTree(request.getData().getBytes());
            StringBuilder toml = new StringBuilder();

            if (!root.isObject()) {
                throw new IllegalArgumentException("Invalid XML");
            }

            writeObject(toml, root, "");
            return new Response(true, "success", toml.toString().trim(), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @Override
    public String getType() {
        return "XML_TO_TOML";
    }

    // Keys inside a [table] are relative to it; only table headers use the full dotted path.
    // Plain values (and arrays of values) are written before any sub-table so they stay in this table.
    private static void writeObject(StringBuilder toml, JsonNode node, String path) {
        // 1. write primitives and arrays of primitives first
        node.fields().forEachRemaining(entry -> {
            JsonNode val = entry.getValue();
            String key = tomlKey(entry.getKey());
            if (val.isValueNode()) {
                writePrimitive(toml, key, val);
            } else if (val.isArray() && !val.isEmpty() && val.get(0).isValueNode()) {
                toml.append(key)
                        .append(" = ")
                        .append(formatArray(val))
                        .append("\n");
            }
        });

        // 2. write tables and arrays of tables
        node.fields().forEachRemaining(entry -> {
            String key = tomlKey(entry.getKey());
            JsonNode val = entry.getValue();
            String newPath = path.isEmpty() ? key : path + "." + key;

            if (val.isObject()) {
                toml.append("\n[").append(newPath).append("]\n");
                writeObject(toml, val, newPath);
            }
            else if (val.isArray() && !val.isEmpty() && !val.get(0).isValueNode()) {
                writeArray(toml, val, newPath);
            }
        });
    }

    private static String tomlKey(String key) {
        return key.matches("[A-Za-z0-9_-]+") ? key : "\"" + escape(key) + "\"";
    }

    /* ===================== ARRAYS ===================== */

    private static void writeArray(StringBuilder toml, JsonNode array, String path) {
        JsonNode first = array.get(0);

        // array of objects → [[table]]
        if (first.isObject()) {
            for (JsonNode item : array) {
                if (!item.isObject()) {
                    throw new IllegalArgumentException("Mixed arrays not allowed: " + path);
                }
                toml.append("\n[[")
                        .append(path)
                        .append("]]\n");
                writeObject(toml, item, path);
            }
            return;
        }

        throw new IllegalArgumentException("Unsupported array type: " + path);
    }

    /* ===================== PRIMITIVES ===================== */

    private static void writePrimitive(StringBuilder toml, String key, JsonNode value) {
        if (value.isNull()) return;

        toml.append(key)
                .append(" = ")
                .append(formatValue(value))
                .append("\n");
    }

    private static String formatValue(JsonNode value) {
        if (value.isTextual())
            return "\"" + escape(value.asText()) + "\"";
        if (value.isBoolean())
            return String.valueOf(value.asBoolean());
        if (value.isNumber())
            return value.numberValue().toString();

        throw new IllegalArgumentException("Unsupported primitive: " + value);
    }

    private static String formatArray(JsonNode array) {
        List<String> values = new ArrayList<>();
        for (JsonNode n : array) {
            if (!n.isValueNode()) {
                throw new IllegalArgumentException("Mixed arrays not allowed");
            }
            values.add(formatValue(n));
        }
        return "[" + String.join(", ", values) + "]";
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }
}
