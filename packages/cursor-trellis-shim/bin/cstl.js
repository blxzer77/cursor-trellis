#!/usr/bin/env node

import { warnLegacyCliOnce } from "@blxzer/pactile/compat";

warnLegacyCliOnce();
import("@blxzer/pactile/cli");
