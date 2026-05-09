import noNondeterministic from "./rules/no-nondeterministic.js";

const plugin = {
  meta: { name: "@piz/sim", version: "0.0.0" },
  rules: {
    "no-nondeterministic": noNondeterministic,
  },
};

export default plugin;
