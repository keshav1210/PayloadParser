package com.payload.parser.sdlc;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SdlcRendererTest {

    @Test
    void blockOnItsOwnLinesIsRemovedWithItsTagLines() {
        String t = "| a |\n{{#if dev}}\n| b |\n{{/if}}\n| c |\n";
        assertEquals("| a |\n| b |\n| c |\n", SdlcRenderer.render(t, Set.of("dev"), Map.of()));
        assertEquals("| a |\n| c |\n", SdlcRenderer.render(t, Set.of(), Map.of()));
    }

    @Test
    void inlineBlocksKeepTheRestOfTheLine() {
        String t = "Packs: Core{{#if dev}}, Developer{{/if}}{{#if tester}}, Tester{{/if}}\nnext";
        assertEquals("Packs: Core, Tester\nnext", SdlcRenderer.render(t, Set.of("tester"), Map.of()));
    }

    @Test
    void unlessIsTheOppositeOfIf() {
        String t = "{{#if name}}{{name}}{{/if}}{{#unless name}}Untitled{{/unless}}";
        assertEquals("Shop", SdlcRenderer.render(t, Set.of("name"), Map.of("name", "Shop")));
        assertEquals("Untitled", SdlcRenderer.render(t, Set.of(), Map.of()));
    }

    @Test
    void nestedBlocksOfBothKinds() {
        String t = "{{#if a}}A{{#unless b}}-notB{{/unless}}{{#if c}}-C{{/if}}{{/if}}";
        assertEquals("A-notB-C", SdlcRenderer.render(t, Set.of("a", "c"), Map.of()));
        assertEquals("A", SdlcRenderer.render(t, Set.of("a", "b"), Map.of()));
        assertEquals("", SdlcRenderer.render(t, Set.of("b", "c"), Map.of()));
    }

    @Test
    void valuesAreNotRescanned() {
        String out = SdlcRenderer.render("x {{v}} y", Set.of(), Map.of("v", "{{#if dev}}$1\\{{other}}"));
        assertEquals("x {{#if dev}}$1\\{{other}} y", out);
    }

    @Test
    void unknownVariablesAreLeftForTheValidatorToReport() {
        assertEquals("{{missing}}", SdlcRenderer.render("{{missing}}", Set.of(), Map.of()));
    }
}
