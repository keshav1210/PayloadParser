package com.payload.parser.sdlc;

import java.util.Map;

/**
 * One template pack: the core files, a role (dev, tester), a stack profile, a test framework or an extra.
 * {@code files} maps the generated path (e.g. {@code .claude/skills/research/SKILL.md}) to the raw template text.
 */
public record SdlcPack(String id, String group, String label, String requires, Map<String, String> files) {
}
