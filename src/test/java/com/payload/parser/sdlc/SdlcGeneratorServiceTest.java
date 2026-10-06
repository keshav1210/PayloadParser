package com.payload.parser.sdlc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SdlcGeneratorServiceTest {

    static final List<String> ALL_FRAMEWORKS = List.of("junit5", "testng", "selenium-java", "rest-assured", "espresso",
            "jest", "vitest", "playwright", "cypress", "pytest", "xunit", "nunit", "go-test", "rspec", "phpunit",
            "xctest", "postman", "k6");

    static SdlcTemplateStore store;
    static SdlcGeneratorService service;

    @BeforeAll
    static void load() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        store = new SdlcTemplateStore(mapper);
        service = new SdlcGeneratorService(store, mapper);
    }

    static SdlcRequest request(boolean dev, boolean tester, List<String> profiles, List<String> frameworks) {
        return new SdlcRequest(null, null, null, dev, tester, profiles, frameworks, List.of(), List.of(),
                null, false, null, null, Map.of());
    }

    static Stream<SdlcRequest> combinations() {
        return Stream.of(
                request(false, false, List.of(), List.of()),
                request(true, false, List.of(), List.of()),
                request(false, true, List.of(), List.of()),
                request(true, true, List.of("spring-boot"), List.of("junit5", "rest-assured")),
                request(false, true, List.of(), List.of("jest", "playwright")),
                request(true, true, List.of("spring-boot"), ALL_FRAMEWORKS),
                request(true, true, List.of("react", "node-api"), List.of("vitest", "playwright")),
                new SdlcRequest(null, null, null, true, true, List.of(), List.of(), ALL_EXTRAS, List.of(),
                        null, false, null, null, Map.of()),
                new SdlcRequest(null, null, null, false, true, List.of(), List.of(),
                        List.of("performance", "accessibility", "onboarding", "postmortem"), List.of(),
                        null, false, null, null, Map.of()));
    }

    static final List<String> ALL_EXTRAS = List.of("database", "performance", "accessibility", "api-docs",
            "onboarding", "postmortem", "tech-debt");

    @Test
    void extrasAddTheirCommandsAndNeedTheirRole() {
        SdlcKit kit = service.generate(new SdlcRequest(null, null, null, true, false, List.of(), List.of(), ALL_EXTRAS,
                List.of(), null, false, null, null, Map.of()));
        assertTrue(kit.files().containsKey(".claude/skills/db-migration/SKILL.md"));
        assertTrue(kit.files().containsKey(".claude/agents/performance-analyst.md"));
        assertTrue(kit.files().containsKey("docs/sdlc/incidents/_template-postmortem.md"));
        String claude = kit.files().get("CLAUDE.md");
        assertTrue(claude.contains("`/tech-debt-scan [area]`"));
        assertTrue(claude.contains("`db-reviewer`"));
        assertFalse(service.generate(request(true, false, List.of(), List.of())).files().get("CLAUDE.md").contains("/postmortem"));
        assertThrows(SdlcRequestException.class, () -> service.generate(new SdlcRequest(null, null, null, false, true,
                List.of(), List.of(), List.of("database"), List.of(), null, false, null, null, Map.of())));
    }

    @ParameterizedTest
    @MethodSource("combinations")
    void everyCombinationIsAValidPlugin(SdlcRequest r) {
        SdlcKit kit = service.generate(r, true);
        List<String> errors = kit.issues().stream()
                .filter(i -> i.severity() == SdlcIssue.Severity.ERROR)
                .map(i -> i.path() + ": " + i.message()).toList();
        assertTrue(errors.isEmpty(), () -> String.join("\n", errors));
        assertTrue(kit.files().containsKey(".claude-plugin/plugin.json"));
        assertTrue(kit.files().containsKey("skills/setup/SKILL.md"));
        assertTrue(kit.files().containsKey("templates/CLAUDE.md"));
        assertFalse(kit.files().keySet().stream().anyMatch(p -> p.startsWith(".claude/")));
    }

    @ParameterizedTest
    @MethodSource("combinations")
    void everyCombinationIsAValidWorkspace(SdlcRequest r) {
        SdlcKit kit = service.generate(r, SdlcEdition.WORKSPACE);
        List<String> errors = kit.issues().stream()
                .filter(i -> i.severity() == SdlcIssue.Severity.ERROR)
                .map(i -> i.path() + ": " + i.message()).toList();
        assertTrue(errors.isEmpty(), () -> String.join("\n", errors));
        assertTrue(kit.files().containsKey(".claude/rules/workspace.md"));
        assertTrue(kit.files().containsKey(".claude/skills/add-service/SKILL.md"));
    }

    static SdlcRequest workspaceRequest() {
        return new SdlcRequest("Shop platform", "Online shop split into services.", null, true, true,
                List.of("spring-boot"), List.of("junit5"), List.of(), List.of(), null, false, null, null, Map.of(),
                List.of(new SdlcRequest.Service("order-service", "Orders and checkout", "Java 17, Spring Boot", "https://github.com/acme/order-service.git"),
                        new SdlcRequest.Service("payment-service", "", "", ""),
                        new SdlcRequest.Service("./web-app/", "Customer web app | React", "React 18", "git@github.com:acme/web-app.git")));
    }

    @Test
    void workspaceDocumentsEachServiceAndSharesTheSetup() {
        SdlcKit kit = service.generate(workspaceRequest(), SdlcEdition.WORKSPACE);
        assertFalse(kit.hasErrors(), () -> kit.issues().toString());
        Map<String, String> f = kit.files();
        String order = f.get("docs/sdlc/services/order-service.md");
        assertTrue(order.contains("# order-service"));
        assertTrue(order.contains("Orders and checkout"));
        assertTrue(order.contains("Java 17, Spring Boot"));
        assertTrue(f.get("docs/sdlc/services/payment-service.md").contains("<!-- FILL: what this service is responsible for"));
        assertTrue(f.get("docs/sdlc/services/web-app.md").contains("Customer web app \\| React"));
        assertTrue(f.get("docs/sdlc/services/_template-service.md").contains("<service folder>"));

        String folders = f.get("docs/sdlc/01-folder-structure.md");
        assertTrue(folders.contains("# Workspace and services"));
        assertTrue(folders.contains("| `order-service/` | Orders and checkout | Java 17, Spring Boot | https://github.com/acme/order-service.git |"));
        assertFalse(folders.contains("Where new code goes"));

        assertTrue(f.get("services.txt").contains("order-service https://github.com/acme/order-service.git"));
        assertTrue(f.get("services.txt").contains("# payment-service <add the git URL>"));
        assertTrue(f.get(".gitignore").contains("/order-service/\n/payment-service/\n/web-app/"));
        assertTrue(f.containsKey("clone-services.ps1"));
        assertTrue(f.containsKey("clone-services.sh"));
        assertTrue(f.containsKey("WORKSPACE-README.md"));

        String claude = f.get("CLAUDE.md");
        assertTrue(claude.contains("multi-service workspace"));
        assertTrue(claude.contains("`/add-service <git URL>`"));
        assertTrue(claude.contains("`docs/sdlc/services/<service>.md`"));
        assertTrue(f.get(".claude/skills/review-changes/SKILL.md").contains("git -C <service>"));
        assertTrue(f.get(".claude/rules/coding-standards.md").contains("  - \"**/src/**\""));
        assertTrue(f.get(".claude/rules/spring-boot.md").contains("  - \"**/*.java\""));
        assertFalse(f.get(".claude/rules/spring-boot.md").contains("**/**/"));
        assertTrue(f.get("SDLC-QUICKSTART.md").contains("workspace edition"));
    }

    @Test
    void projectEditionHasNoWorkspaceText() {
        SdlcKit kit = service.generate(workspaceRequest(), SdlcEdition.PROJECT);
        assertFalse(kit.files().containsKey("services.txt"));
        assertFalse(kit.files().keySet().stream().anyMatch(p -> p.startsWith("docs/sdlc/services/")));
        assertFalse(kit.files().get(".claude/skills/review-changes/SKILL.md").contains("Workspace:"));
        assertFalse(kit.files().get("CLAUDE.md").contains("multi-service"));
        assertTrue(kit.files().get(".claude/rules/coding-standards.md").contains("  - \"src/**\""));
        assertTrue(kit.files().get("docs/sdlc/01-folder-structure.md").contains("## Where new code goes"));
    }

    @Test
    void invalidServicesAreRejected() {
        SdlcRequest badFolder = new SdlcRequest(null, null, null, true, false, List.of(), List.of(), List.of(), List.of(),
                null, false, null, null, Map.of(), List.of(new SdlcRequest.Service("../etc", "", "", "")));
        assertThrows(SdlcRequestException.class, () -> service.generate(badFolder, SdlcEdition.WORKSPACE));
        SdlcRequest badUrl = new SdlcRequest(null, null, null, true, false, List.of(), List.of(), List.of(), List.of(),
                null, false, null, null, Map.of(), List.of(new SdlcRequest.Service("api", "", "", "ftp://x | y")));
        assertThrows(SdlcRequestException.class, () -> service.generate(badUrl, SdlcEdition.WORKSPACE));
    }

    @Test
    void pluginNamespacesCommandsAgentsAndReferences() throws Exception {
        SdlcRequest r = new SdlcRequest(null, null, null, true, true, List.of(), List.of(), List.of(), List.of(),
                "team", true, "npm run lint", null, Map.of());
        SdlcKit kit = service.generate(r, true);
        Map<String, String> f = kit.files();
        assertTrue(f.containsKey("skills/research/SKILL.md"), "prefix is ignored in the plugin: the plugin name namespaces it");
        assertTrue(f.containsKey("agents/researcher.md"));
        assertTrue(f.containsKey("templates/.claude/rules/security.md"));
        assertTrue(f.containsKey("templates/docs/sdlc/00-project-overview.md"));
        assertTrue(f.containsKey("templates/CLAUDE.md"), "the setup command handles an existing CLAUDE.md");
        String claude = f.get("templates/CLAUDE.md");
        assertTrue(claude.contains("`/sdlc-kit:research <question>`"));
        assertTrue(claude.contains("`sdlc-kit:researcher`"));
        assertTrue(f.get("skills/research/SKILL.md").contains("\nagent: sdlc-kit:researcher\n"));
        assertTrue(f.get("skills/research/SKILL.md").contains("\nname: research\n"));
        assertTrue(f.get("skills/sdlc-init/SKILL.md").contains("`${CLAUDE_PLUGIN_ROOT}/skills/analyze-structure/SKILL.md`"));
        assertTrue(f.get("skills/setup/SKILL.md").contains("`/sdlc-kit:sdlc-init`"));
        assertTrue(f.get("README.md").contains("`/sdlc-kit:setup`"));
        assertFalse(f.get("README.md").contains("sdlc-kit:sdlc-kit"));
        assertFalse(f.get("agents/architect.md").contains("permissionMode"));
        assertTrue(f.get("templates/SDLC-QUICKSTART.md").contains("plugin edition"));
        assertFalse(f.get("templates/SDLC-QUICKSTART.md").contains("Unzip the kit into your project"));

        ObjectMapper m = new ObjectMapper();
        JsonNode manifest = m.readTree(f.get(".claude-plugin/plugin.json"));
        assertEquals("sdlc-kit", manifest.path("name").asText());
        assertEquals("npm run lint", m.readTree(f.get("hooks/hooks.json")).path("hooks").path("Stop").get(0).path("hooks").get(0).path("command").asText());
        assertTrue(m.readTree(f.get("templates/.claude/settings.json")).path("hooks").isMissingNode(), "hook must not run twice");
        assertEquals(".claude-plugin/plugin.json", f.keySet().stream().filter(p -> p.contains("/")).findFirst().orElseThrow());
    }

    @Test
    void profilesAddPathScopedRules() {
        SdlcKit kit = service.generate(request(true, false, List.of("react", "node-api"), List.of()));
        assertTrue(kit.files().get(".claude/rules/react.md").startsWith("---\npaths:"));
        assertTrue(kit.files().get(".claude/rules/node-api.md").contains("\"**/routes/**\""));
        assertTrue(kit.files().get("SDLC-QUICKSTART.md").contains("Packs: Core, Developer, React, Node API"));
    }

    @ParameterizedTest
    @MethodSource("combinations")
    void everyCombinationIsValid(SdlcRequest r) {
        SdlcKit kit = service.generate(r);
        List<String> errors = kit.issues().stream()
                .filter(i -> i.severity() == SdlcIssue.Severity.ERROR)
                .map(i -> i.path() + ": " + i.message()).toList();
        assertTrue(errors.isEmpty(), () -> String.join("\n", errors));
        assertTrue(kit.files().containsKey("CLAUDE.md"));
        assertTrue(kit.files().containsKey(".claude/settings.json"));
    }

    @Test
    void coreKitHasNoRoleFilesOrRoleText() {
        SdlcKit kit = service.generate(request(false, false, List.of(), List.of()));
        assertFalse(kit.files().keySet().stream().anyMatch(p -> p.contains("/implement/") || p.contains("/testing/")));
        String claude = kit.files().get("CLAUDE.md");
        assertFalse(claude.contains("/implement"));
        assertFalse(claude.contains("/test-cases"));
        assertTrue(claude.contains("/sdlc-init"));
    }

    @Test
    void rolesAddTheirCommandsToClaudeMd() {
        String claude = service.generate(request(true, true, List.of(), List.of())).files().get("CLAUDE.md");
        assertTrue(claude.contains("`/implement <story>`"));
        assertTrue(claude.contains("`/test-cases <story>`"));
        assertTrue(claude.contains("Developer flow"));
        assertTrue(claude.contains("Tester flow"));
    }

    @Test
    void projectDetailsReplaceTheFillHints() {
        SdlcRequest r = new SdlcRequest("Invoice App", "Small shops create GST invoices.", "Java 17, Spring Boot 3.5",
                true, false, List.of(), List.of(), List.of(),
                List.of(new SdlcRequest.FolderNote("src/main/java", "Backend"),
                        new SdlcRequest.FolderNote("src\\main\\resources\\static", ""),
                        new SdlcRequest.FolderNote("node_modules/x", "ignored"),
                        new SdlcRequest.FolderNote("../secret", "ignored"),
                        new SdlcRequest.FolderNote("./docs/", "Documentation")),
                null, false, null, null, Map.of());
        SdlcKit kit = service.generate(r);
        String overview = kit.files().get("docs/sdlc/00-project-overview.md");
        assertTrue(overview.contains("# Invoice App: overview"));
        assertTrue(overview.contains("Small shops create GST invoices."));
        assertTrue(overview.contains("Java 17, Spring Boot 3.5"));
        assertFalse(overview.contains("what the product does"));
        String folders = kit.files().get("docs/sdlc/01-folder-structure.md");
        assertTrue(folders.contains("└── src/") || folders.contains("├── src/"));
        assertTrue(folders.contains("resources/"));
        assertFalse(folders.contains("static/"), "tree stops at 3 levels");
        assertTrue(folders.contains("| `src/main/java/` | Backend |"));
        assertTrue(folders.contains("| `docs/` | Documentation |"));
        assertFalse(folders.contains("node_modules"));
        assertFalse(folders.contains("secret"));
        assertTrue(kit.files().get("CLAUDE.md").contains("# Invoice App: instructions for Claude"));
        assertFalse(kit.hasErrors());
    }

    @Test
    void userTextCannotInjectTemplateCode() {
        SdlcRequest r = new SdlcRequest("{{folderTree}}", "{{#if dev}}x{{/if}} <!-- hidden -->", null,
                false, false, List.of(), List.of(), List.of(), List.of(), null, false, null, null, Map.of());
        SdlcKit kit = service.generate(r);
        assertFalse(kit.hasErrors(), () -> kit.issues().toString());
        String overview = kit.files().get("docs/sdlc/00-project-overview.md");
        assertTrue(overview.contains("{ {#if dev} }x{ {/if} }"));
        assertFalse(overview.contains("hidden -->"));
    }

    @Test
    void prefixRenamesCommandsEverywhere() {
        SdlcRequest r = new SdlcRequest(null, null, null, true, true, List.of(), List.of(), List.of(), List.of(),
                "Team", false, null, null, Map.of());
        SdlcKit kit = service.generate(r);
        assertFalse(kit.hasErrors(), () -> kit.issues().toString());
        assertTrue(kit.files().containsKey(".claude/skills/team-research/SKILL.md"));
        assertFalse(kit.files().containsKey(".claude/skills/research/SKILL.md"));
        assertTrue(kit.files().get(".claude/skills/team-research/SKILL.md").contains("\nname: team-research\n"));
        String claude = kit.files().get("CLAUDE.md");
        assertTrue(claude.contains("`/team-research <question>`"));
        assertTrue(claude.contains("`docs/sdlc/research/`"));
        assertTrue(kit.files().get(".claude/skills/team-sdlc-init/SKILL.md").contains(".claude/skills/team-analyze-structure/SKILL.md"));
        assertTrue(kit.files().get(".claude/agents/researcher.md").contains("name: researcher"));
    }

    @Test
    void badPrefixIsRejected() {
        SdlcRequest r = new SdlcRequest(null, null, null, false, false, List.of(), List.of(), List.of(), List.of(),
                "my team!", false, null, null, Map.of());
        assertThrows(SdlcRequestException.class, () -> service.generate(r));
    }

    @Test
    void existingClaudeMdIsNotOverwritten() {
        SdlcRequest r = new SdlcRequest(null, null, null, true, false, List.of(), List.of(), List.of(), List.of(),
                null, true, null, null, Map.of());
        SdlcKit kit = service.generate(r);
        assertFalse(kit.files().containsKey("CLAUDE.md"));
        assertTrue(kit.files().containsKey("CLAUDE.sdlc.md"));
        assertTrue(kit.files().get("SDLC-QUICKSTART.md").contains("`@CLAUDE.sdlc.md`"));
        assertFalse(kit.hasErrors(), () -> kit.issues().toString());
    }

    @Test
    void lintCommandBecomesAStopHook() throws Exception {
        SdlcRequest r = new SdlcRequest(null, null, null, true, false, List.of(), List.of(), List.of(), List.of(),
                null, false, "./mvnw -q spotless:apply", "powershell", Map.of());
        JsonNode settings = new ObjectMapper().readTree(service.generate(r).files().get(".claude/settings.json"));
        JsonNode hook = settings.path("hooks").path("Stop").get(0).path("hooks").get(0);
        assertEquals("command", hook.path("type").asText());
        assertEquals("./mvnw -q spotless:apply", hook.path("command").asText());
        assertEquals("powershell", hook.path("shell").asText());
        assertTrue(settings.path("permissions").path("deny").size() > 5);
    }

    @Test
    void multiLineLintCommandIsRejected() {
        SdlcRequest r = new SdlcRequest(null, null, null, false, false, List.of(), List.of(), List.of(), List.of(),
                null, false, "npm run lint\nrm -rf /", null, Map.of());
        assertThrows(SdlcRequestException.class, () -> service.generate(r));
    }

    @Test
    void frameworksNeedTheTesterRole() {
        assertThrows(SdlcRequestException.class, () -> service.generate(request(true, false, List.of(), List.of("jest"))));
    }

    @Test
    void unknownPacksAreRejected() {
        assertThrows(SdlcRequestException.class, () -> service.generate(request(true, false, List.of("nope"), List.of())));
        assertThrows(SdlcRequestException.class, () -> service.generate(request(true, true, List.of("jest"), List.of())));
    }

    @Test
    void userEditsAreAppliedAndOnlyWarned() {
        Map<String, String> edits = Map.of(
                "docs/sdlc/00-project-overview.md", "# My overview\r\n",
                ".claude/skills/research/SKILL.md", "---\nname: research\ndescription: broken: yaml: here\n---\nbody\n",
                ".claude/skills/does-not-exist/SKILL.md", "x");
        SdlcRequest r = new SdlcRequest(null, null, null, false, false, List.of(), List.of(), List.of(), List.of(),
                null, false, null, null, edits);
        SdlcKit kit = service.generate(r);
        assertEquals("# My overview\n", kit.files().get("docs/sdlc/00-project-overview.md"));
        assertFalse(kit.hasErrors(), () -> kit.issues().toString());
        assertTrue(kit.issues().stream().anyMatch(i -> i.path().equals(".claude/skills/research/SKILL.md")));
        assertTrue(kit.issues().stream().anyMatch(i -> i.path().equals(".claude/skills/does-not-exist/SKILL.md")));
    }

    @Test
    void attributionGoesAfterFrontmatter() {
        SdlcKit kit = service.generate(request(false, false, List.of(), List.of()));
        String skill = kit.files().get(".claude/skills/research/SKILL.md");
        assertTrue(skill.startsWith("---\nname: research\n"));
        assertTrue(skill.contains("\n---\n<!-- Generated by jsonxmleditor.com"));
        assertTrue(kit.files().get("CLAUDE.md").startsWith("<!-- Generated by jsonxmleditor.com"));
        assertFalse(kit.files().get(".claude/settings.json").contains("Generated"));
    }

    @Test
    void zipHoldsEveryFileAtTheRoot() throws Exception {
        SdlcKit kit = service.generate(request(true, true, List.of(), List.of("junit5")));
        List<String> names = new ArrayList<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(SdlcZip.write(kit.files())))) {
            for (ZipEntry e; (e = zip.getNextEntry()) != null; ) names.add(e.getName());
        }
        assertEquals(kit.files().keySet().stream().collect(Collectors.toList()), names);
        assertEquals("CLAUDE.md", names.get(0));
    }

    @Test
    void catalogueListsEveryPackOnDisk() {
        for (SdlcPack p : store.packs().values()) {
            assertFalse(p.group().equals("unknown"), "pack missing from packs.json: " + p.id());
            assertNotNull(p.label());
        }
    }
}
