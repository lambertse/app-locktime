package api

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// RegisterSPACatchAll adds a catch-all route that serves index.html for any
// non-API path. This enables React Router's client-side routing to work when
// the browser navigates directly to a deep link (e.g. /rules/:id/edit).
//
// frontendFS must be an fs.FS rooted at the directory containing index.html
// (e.g. the embedded dist/ directory). If nil, the catch-all is skipped.
func RegisterSPACatchAll(r *gin.Engine, frontendFS fs.FS) {
	if frontendFS == nil {
		return
	}

	r.NoRoute(func(c *gin.Context) {
		// API paths that weren't matched → 404 JSON, not the SPA.
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		// Everything else → serve index.html so React Router can take over.
		c.FileFromFS("index.html", http.FS(frontendFS))
	})
}
