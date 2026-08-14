# Renderer V2 prototype development code

This directory contains UI and instrumentation used only while developing, tuning, diagnosing,
and benchmarking the Renderer V2 prototype.

Do not port this directory into the final TaskMap application. Production integration should omit
these controls, overlays, diagnostic modes, capture probes, and benchmark counters.

Reusable renderer runtime code, Liquid materials, panel geometry, Canvas Browser behavior, and
modular Canvas Element implementations must remain outside this development-only boundary.
