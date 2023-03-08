// Copyright (C) 2023 Christoph Schlosser
// This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License version 2 as published by the Free Software Foundation.
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
// You should have received a copy of the GNU General Public License along with this program; if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA. Also add information on how to contact you by electronic and paper mail.

const storage = chrome.storage.local;
const template = document.getElementById('project_template');
const projectsDiv = document.getElementById('projects');
const currentPeriod = document.getElementById('current_period');
const newProjectNameInput = document.querySelector('#new_project_name');
const startTrackingBtn = document.getElementById('start_tracking_btn');
const stopTrackingBtn = document.getElementById('stop_tracking_btn');
const addProjectBtn = document.getElementById('add_project_btn');
const removeProjectBtn = document.getElementById('remove_project_btn');
const resetProjectBtn = document.getElementById('reset_project_btn');
const stoppedButtons = new Array(startTrackingBtn, addProjectBtn, removeProjectBtn, resetProjectBtn);
const runningButtons = new Array(stopTrackingBtn);

let startTime = 0;
let updateTimer = null;

const getSelectedProject = () => document.querySelector('input[name="project"]:checked');

const formatMilliseconds = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  const timeArray = [];

  if (days) timeArray.push(`${days} day${days === 1 ? '' : 's'}`);
  if (remainingHours) timeArray.push(`${remainingHours} hour${remainingHours === 1 ? '' : 's'}`);
  if (remainingMinutes) timeArray.push(`${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`);
  if (remainingSeconds) timeArray.push(`${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`);

  return timeArray.length ? timeArray.join(', ') : '0 seconds';
};

const getStored = (key) => storage.get([key]);

const store = (obj) => storage.set(obj);

const getStoredProjects = () => getStored('projects').then((storedProjects) => {
  return storedProjects.projects;
});

const getProjects = async () => {
  const projects = await getStoredProjects();

  const elements = projects.map(({ name, tracked }) => {
    const element = template.content.firstElementChild.cloneNode(true);

    const input = element.querySelector('input');
    input.setAttribute('value', name);

    element.querySelector('.project-name').textContent = name;
    element.querySelector('.tracked-time').textContent = formatMilliseconds(tracked);

    return element;
  });

  projectsDiv.innerHTML = '';
  projectsDiv.append(...elements);
};

const addProject = async () => {
  const name = newProjectNameInput.value.trim();
  if (!name) return;

  const projects = await getStoredProjects();

  projects.push({ name, tracked: 0 });

  await store({ "projects": projects });
  getProjects();

  newProjectNameInput.value = '';
};

const removeProject = async () => {
  const active_project = getSelectedProject();
  if(!active_project) {
    currentPeriod.innerText = "Please select a project";
    return;
  }

  const projects = await getStoredProjects();

  const remaining_projects = projects.filter(project => project.name != active_project.value);

  store({ "projects": remaining_projects });

  getProjects();
};

const resetProject = async () => {
  const active_project = getSelectedProject();
  if(!active_project) {
    currentPeriod.innerText = "Please select a project";
    return;
  }

  const projects = await getStoredProjects();
  const updated_projects = new Array();

  for (const project of projects) {
    if (project.name === active_project.value) {
      project.tracked = 0;
    }
    updated_projects.push(project);
  }

  store({ "projects": updated_projects });

  getProjects();
};

const updateTime = () => {
  if (startTime === 0) {
    return;
  }

  currentPeriod.innerText = formatMilliseconds(Date.now() - startTime);

  updateTimer = setTimeout(updateTime, 100);
};

const disable = (element, shouldDisable) => {
  if(shouldDisable) {
    element.setAttribute("disabled", true);
  } else {
    element.removeAttribute("disabled");
  }
};

const disableButtons = (stopped) => {
  for (const btn of stoppedButtons) {
    disable(btn, stopped);
  }

  for (const child of projectsDiv.childNodes) {
    disable(child, stopped);
    disable(child.childNodes[1], stopped);
  }

  for (const btn of runningButtons) {
    disable(btn, !stopped);
  }
};

const startTracking = async () => {
  const selected_project = getSelectedProject();
  if(!selected_project) {
    currentPeriod.innerText = "Please select a project";
    return;
  }

  disableButtons(true);

  startTime = Date.now();

  updateTimer = setTimeout(updateTime, 100);
  await store({ "active": {
    "start_time": startTime,
    "project": selected_project.value
  }});
}

const stopTracking = async() => {
  const expired_time = Date.now() - startTime;
  clearTimeout(updateTime);
  await storage.remove("active");
  currentPeriod.innerText = "";
  startTime = 0;

  disableButtons(false);

  const projects = await getStoredProjects();
  const selected_project = getSelectedProject();
  if(!selected_project) {
    return;
  }
  const active_project = selected_project.value;
  for (const project of projects) {
    if (project.name === active_project) {
      project.tracked = project.tracked + expired_time;

      await store({ "projects": projects });

      getProjects();

      return;
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  addProjectBtn.addEventListener('click', addProject);
  removeProjectBtn.addEventListener('click', removeProject);
  resetProjectBtn.addEventListener('click', resetProject);
  startTrackingBtn.addEventListener('click', startTracking);
  stopTrackingBtn.addEventListener('click', stopTracking);

  getProjects();

  const stored = await getStored("active");
  if (Object.keys(stored).length !== 0) {
    // has to go before startTracking as startTracking looks for the checked project.
    for (const child of projectsDiv.childNodes) {
      if(child.querySelector("input").value === stored.active.project) {
        child.querySelector("input").setAttribute("checked", true);
        break;
      }
    }
    // This overwrites the stored start_time with Date.now()
    startTracking();
    startTime = stored.active.start_time;
    // So we set it back to the value we retrieved before here.
    store(stored);
  }
});

