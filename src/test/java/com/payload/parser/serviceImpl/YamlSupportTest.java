package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YamlSupportTest {

    private JsonNode read(String yaml) {
        List<JsonNode> docs = YamlSupport.readDocuments(yaml);
        assertEquals(1, docs.size());
        return docs.get(0);
    }

    @Test
    void resolvesAnchorsAliasesAndMergeKeys() {
        JsonNode doc = read("""
                defaults: &defaults
                  adapter: postgres
                  pool: 5
                dev:
                  <<: *defaults
                  database: dev_db
                copy: *defaults
                """);
        assertEquals("postgres", doc.at("/dev/adapter").asText());
        assertEquals(5, doc.at("/dev/pool").asInt());
        assertEquals("dev_db", doc.at("/dev/database").asText());
        assertTrue(doc.at("/dev/<<").isMissingNode());
        assertEquals("postgres", doc.at("/copy/adapter").asText());
    }

    @Test
    void keepsDatesAsWrittenAndEmptyValuesAsNull() {
        JsonNode doc = read("""
                released: 2026-01-05
                at: 2026-01-05T10:15:00Z
                empty:
                tilde: ~
                version: 1.10
                script: |
                  echo one
                  echo two
                """);
        assertEquals("2026-01-05", doc.get("released").asText());
        assertEquals("2026-01-05T10:15:00Z", doc.get("at").asText());
        assertTrue(doc.get("empty").isNull());
        assertTrue(doc.get("tilde").isNull());
        assertEquals(1.1, doc.get("version").asDouble());
        assertEquals("echo one\necho two\n", doc.get("script").asText());
    }

    @Test
    void readsEveryDocument() {
        assertEquals(2, YamlSupport.readDocuments("a: 1\n---\nb: 2\n").size());
    }

    @Test
    void reportsDuplicateKeysWithTheirLine() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> YamlSupport.readDocuments("a: 1\nb: 2\na: 3\n"));
        assertTrue(e.getMessage().startsWith("line 3,"), e.getMessage());
        assertTrue(e.getMessage().contains("duplicate key"), e.getMessage());
    }

    @Test
    void reportsTabIndentationWithItsLine() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> YamlSupport.readDocuments("server:\n\tport: 8080\n"));
        assertTrue(e.getMessage().startsWith("line 2,"), e.getMessage());
    }
}
