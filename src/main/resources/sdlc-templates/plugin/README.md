# Claude Code SDLC Kit (plugin)

Commands and agents for the whole development{{#if tester}} and testing{{/if}} workflow, as a Claude Code plugin named
`sdlc-kit`. Commands are used as `/sdlc-kit:<command>`, agents as `sdlc-kit:<agent>`.

## Install

Pick one:

- **For you, in every project**: create the folder `~/.claude/skills/sdlc-kit/` (on Windows
  `%USERPROFILE%\.claude\skills\sdlc-kit\`) and unzip this archive into it, so that
  `~/.claude/skills/sdlc-kit/.claude-plugin/plugin.json` exists. Claude Code loads it in every new session;
  in a running session, run `/reload-plugins`.
- **Try it for one session**: `claude --plugin-dir ./claude-sdlc-plugin.zip`

Check it loaded: run `/plugin` and look for `sdlc-kit` in the Installed tab.

## Use it in a project

1. Open Claude Code in the project and run `/sdlc-kit:setup`. It copies the project files (instructions,
   rules, safety settings and the `docs/sdlc/` templates) into the project, without overwriting anything you
   already have.
2. Run `/sdlc-kit:sdlc-init` to fill in the docs from your code.
3. See `SDLC-QUICKSTART.md` in your project for every command.

Plugins can't include project instructions, rules or permission settings, which is why the setup step copies
them into each project. Commit them so your team shares the same setup.
