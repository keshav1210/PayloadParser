package com.payload.parser.sdlc;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SdlcControllerTest {

    static MockMvc mvc;

    @BeforeAll
    static void setUp() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        SdlcTemplateStore store = new SdlcTemplateStore(mapper);
        mvc = MockMvcBuilders.standaloneSetup(new SdlcController(new SdlcGeneratorService(store, mapper), store)).build();
    }

    @Test
    void packsListsLabelsButNoTemplateContent() throws Exception {
        mvc.perform(get("/api/sdlc/packs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packs[?(@.id == 'playwright')].label").value("Playwright"))
                .andExpect(content().string(org.hamcrest.Matchers.not(containsString("SKILL.md"))));
    }

    @Test
    void previewReturnsFilesAndSummary() throws Exception {
        mvc.perform(post("/api/sdlc/preview").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"developer\":true,\"tester\":true,\"testFrameworks\":[\"jest\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].path").value("CLAUDE.md"))
                .andExpect(jsonPath("$.summary.commands", greaterThan(20)))
                .andExpect(jsonPath("$.summary.downloadable").value(true));
    }

    @Test
    void generateReturnsAZip() throws Exception {
        mvc.perform(post("/api/sdlc/generate").contentType(MediaType.APPLICATION_JSON).content("{\"developer\":true}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/zip"))
                .andExpect(header().string("Content-Disposition", containsString("claude-sdlc-kit.zip")));
    }

    @Test
    void pluginFormatReturnsThePluginZip() throws Exception {
        mvc.perform(post("/api/sdlc/generate?format=plugin").contentType(MediaType.APPLICATION_JSON).content("{\"tester\":true}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("claude-sdlc-plugin.zip")));
        mvc.perform(post("/api/sdlc/preview?format=plugin").contentType(MediaType.APPLICATION_JSON).content("{\"tester\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].path").value("README.md"))
                .andExpect(jsonPath("$.summary.commands", greaterThan(10)));
        mvc.perform(post("/api/sdlc/generate?format=zip").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/sdlc/generate?format=workspace").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"developer\":true,\"services\":[{\"folder\":\"order-service\",\"purpose\":\"Orders\"}]}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("claude-sdlc-workspace.zip")));
    }

    @Test
    void invalidChoicesGiveA400WithAMessage() throws Exception {
        mvc.perform(post("/api/sdlc/generate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testFrameworks\":[\"jest\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Tester")));
        mvc.perform(post("/api/sdlc/preview").contentType(MediaType.APPLICATION_JSON).content("not json"))
                .andExpect(status().isBadRequest());
    }
}
