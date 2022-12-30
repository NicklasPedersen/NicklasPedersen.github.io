function onloaddo(f) {
    if (document.readyState == "loading") {
        document.addEventListener("DOMContentLoaded", f);
    } else {
        f();
    }
}

const finished = "finished";
const unfinished = "unfinished";
const githubRepo = (base) => "https://github.com/NicklasPedersen/" + base;
const rawContent = (base) => "https://raw.githubusercontent.com/NicklasPedersen/" + base + "/master/README.md";

function readTextFile(file, callback)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.setRequestHeader("Accept", "text/html, */*; q=0.01");
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                callback(rawFile.responseText)
            }
        }
    }
    rawFile.send(null);
}

function getTasks(el, fn) {
    readTextFile(rawContent(el.title), fn);
}

function gen_tasks(num_fin, num_unfin) {
    let tasks = [];
    for (let index = 0; index < num_fin; index++) {
        tasks.push({state: finished});
    }
    for (let index = 0; index < num_unfin; index++) {
        tasks.push({state: unfinished});
    }
    return tasks;
}

let projects = [
    // {
    //     title: "Github Pages", 
    //     link: "https://nicklaspedersen.github.io",
    //     desc: "You are here right now",
    //     tasks: gen_tasks(3, 4),
    // },
    {
        titleOverride: "Github Pages",
        title: "nicklaspedersen.github.io",
        linkOverride: "https://nicklaspedersen.github.io",
        desc: "You are here right now",
    },
    {
        title: "Lexer", 
        desc: "My lexer that still needs a lot of work",
    },
    {
        title: "RISC16", 
        linkOverride: "/cpu.html",
        desc: "RiSC 16 emulator",
    },
    // {
    //     title: "idk", 
    //     link: "https://google.com",
    //     desc: "You are here right now",
    //     tasks: gen_tasks(2, 3),
    // },
];

function compareTask(a, b) {
    if (a.state == b.state) {
        return 0;
    }
    if (a.state == unfinished) {
        return 1;
    }
    return -1;
}

function createProgressBarB(e) {
    let base = document.createElement("div");
    base.className = "bprogress-bar";
    getTasks(e, (t) => {
        let tasks = t.split("\n")
                        .filter((s) => s.startsWith("- ["))
                        .map(s => {
                            return {
                                state: (s.toLowerCase().startsWith("- [x") ? finished : unfinished),
                                desc: s.substring(s.indexOf("]") + 1),
                            }
                        })
                        .sort(compareTask);
        tasks.forEach((task) => {
            let prog = document.createElement("div");
            prog.className = task.state;
            prog.title = task.desc;
            base.appendChild(prog);
        });
    });
    return base;
    e.tasks.forEach((task) => {
        let prog = document.createElement("div");
        prog.className = task.state;
        base.appendChild(prog);
    });
    return base;
    
    const numTasks = e.numTasks;
    const tasksDone = e.tasksDone;
    for (let index = 0; index < tasksDone; index++) {
        let prog = document.createElement("div");
        prog.className = "finished";
        base.appendChild(prog);
    }
    for (let index = tasksDone; index < numTasks; index++) {
        let prog = document.createElement("div");
        prog.className = "unfinished";
        base.appendChild(prog);
    }
    return base;
}

function createSimpleProgressBar(progress) {
    let prog = document.createElement("div");
    prog.style.width = (progress * 100) + "%";
    let base = document.createElement("div");
    base.className = "progress-bar";
    base.appendChild(prog);
    return base;
}

onloaddo(() => {
    projects.forEach((el) => {
        let header = document.createElement("h2");
        header.innerText = el.titleOverride ?? el.title;
        let link = document.createElement("a");
        let linkAddr = el.linkOverride ?? githubRepo(el.title);
        link.innerText = linkAddr;
        link.href = linkAddr;
        let desc = document.createElement("p");
        desc.innerText = el.desc;
        let card = document.createElement("div");
        card.className = "card";
        card.appendChild(header);
        card.appendChild(link);
        card.appendChild(desc);
        if (!el.linkOverride) {
            card.appendChild(createProgressBarB(el));
        }
        document.body.appendChild(card);
    });
});