#!/usr/bin/env node

import { warnLegacyCliOnce } from "./compat-warning.js";

warnLegacyCliOnce();
import("../dist/cli/index.js");
