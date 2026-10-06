# Multi-service workspace

This folder holds the Claude Code SDLC kit for all your services. Each service is cloned into its own
subfolder and keeps its own git repository; the kit applies to all of them.

```
workspace/                      ← open Claude Code here
├── CLAUDE.md, .claude/, docs/sdlc/
├── services.txt                ← the services and their git URLs
├── clone-services.ps1 / .sh    ← clones every service listed
└── <service>/ …                ← each service, its own git repository
```

## Always open Claude Code in this folder

Claude Code loads the kit's commands, agents, rules and safety settings from the folder you open. If you open
a service folder instead, only `CLAUDE.md` is picked up from here. From this folder Claude can work in every
service, and it runs each service's git, build and test commands inside that service's folder.

## Set it up for yourself

1. Unzip the kit into a folder, for example `C:\work\my-platform`.
2. Clone your services into it, or list them in `services.txt` and run the clone script:
   - Windows: `powershell -ExecutionPolicy Bypass -File clone-services.ps1`
   - macOS, Linux, Git Bash: `sh clone-services.sh`
3. Open Claude Code in the folder and run `/sdlc-init`. It reads every service and fills in the system
   overview, the services catalog and a doc per service.

Add a service later with `/add-service <git URL>`.

## Share it with your team

Make this folder its own small git repository. It contains only the kit and the services list; `.gitignore`
keeps the service folders out.

```
git init
git add .
git commit -m "Add Claude Code SDLC workspace"
git remote add origin <your workspace repository URL>
git push -u origin main
```

Teammates clone the workspace repository, run the clone script, and open Claude Code in the folder.
