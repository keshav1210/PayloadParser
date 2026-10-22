package com.payload.parser.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.http.HttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StaticCacheFilterTest {

    private MockHttpServletResponse run(String uri, String query) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setQueryString(query);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain(new jakarta.servlet.http.HttpServlet() {
            @Override
            protected void service(jakarta.servlet.http.HttpServletRequest req, HttpServletResponse res) {
                res.setHeader("Cache-Control", "no-store");
            }
        });
        new StaticCacheFilter().doFilter(request, response, chain);
        return response;
    }

    @Test
    void versionedAssetsAreCachedForAYearAndKeepTheirHeader() throws Exception {
        assertEquals(StaticCacheFilter.VERSIONED, run("/css/site.css", "v=6").getHeader("Cache-Control"));
        assertEquals(StaticCacheFilter.VERSIONED, run("/js/vendor/papaparse.min.js", "v=5.5.3").getHeader("Cache-Control"));
    }

    @Test
    void unversionedAssetsAreCachedForAnHour() throws Exception {
        assertEquals(StaticCacheFilter.UNVERSIONED, run("/css/style.css", null).getHeader("Cache-Control"));
        assertEquals(StaticCacheFilter.UNVERSIONED, run("/og/home.png", null).getHeader("Cache-Control"));
        assertEquals(StaticCacheFilter.UNVERSIONED, run("/js/app.js", "dev=1").getHeader("Cache-Control"));
    }

    @Test
    void pagesAreLeftAlone() throws Exception {
        assertEquals("no-store", run("/json-to-java", null).getHeader("Cache-Control"));
        assertEquals("no-store", run("/blog/what-is-json", null).getHeader("Cache-Control"));
    }

    @Test
    void recognisesStaticAssets() {
        assertTrue(StaticCacheFilter.isStaticAsset("/favicon.png"));
        assertTrue(StaticCacheFilter.isStaticAsset("/js/tools-list.js"));
        assertFalse(StaticCacheFilter.isStaticAsset("/header.html"));
        assertFalse(StaticCacheFilter.isStaticAsset("/data/parse"));
    }
}
