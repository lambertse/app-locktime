//go:build !windows

package api

// clearIFEOKey is a no-op on non-Windows platforms.
func clearIFEOKey(exeName string) {}

// reconcileIFEOForRule is a no-op on non-Windows platforms.
func reconcileIFEOForRule(s *Server, ruleID string) {}
