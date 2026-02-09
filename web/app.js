import { HiGHS } from '/dist/index.browser.js';

const exampleSelect = document.getElementById('example-select');
const runButton = document.getElementById('run-button');
const problemDisplay = document.getElementById('problem-display');
const resultStatus = document.getElementById('result-status');
const resultObjective = document.getElementById('result-objective');
const resultSolution = document.getElementById('result-solution');
const consoleOutput = document.getElementById('console-output');

let currentProblem = '';

async function loadExamples() {
  const response = await fetch('/api/examples');
  const examples = await response.json();

  for (const name of examples) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    exampleSelect.appendChild(option);
  }
}

async function loadProblem(name) {
  const response = await fetch(`/examples/${name}.lp`);
  currentProblem = await response.text();
  problemDisplay.textContent = currentProblem;
  clearResults();
}

function clearResults() {
  resultStatus.textContent = '-';
  resultObjective.textContent = '-';
  resultSolution.textContent = '-';
  consoleOutput.textContent = '';
}

function appendConsole(text) {
  consoleOutput.textContent += text + '\n';
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

async function runSolver() {
  if (!currentProblem) return;

  clearResults();
  runButton.disabled = true;
  resultStatus.textContent = 'Running...';

  try {
    const highs = await HiGHS.create({
      console: {
        log: (msg) => appendConsole(msg),
        error: (msg) => appendConsole(`[ERROR] ${msg}`),
      },
    });

    await highs.parse(currentProblem, 'lp');
    const result = await highs.solve();

    resultStatus.textContent = result.status;

    if (result.objective !== undefined) {
      resultObjective.textContent = result.objective.toString();
    } else {
      resultObjective.textContent = '-';
    }

    if (result.solution) {
      const solutionObj = {};
      for (const [key, value] of result.solution) {
        solutionObj[key] = value;
      }
      resultSolution.textContent = JSON.stringify(solutionObj, null, 2);
    } else {
      resultSolution.textContent = '-';
    }

    highs.free();
  } catch (err) {
    resultStatus.textContent = 'error';
    appendConsole(`Error: ${err}`);
  } finally {
    runButton.disabled = !exampleSelect.value;
  }
}

exampleSelect.addEventListener('change', async () => {
  const selected = exampleSelect.value;
  if (selected) {
    await loadProblem(selected);
    runButton.disabled = false;
  } else {
    problemDisplay.textContent = '';
    currentProblem = '';
    runButton.disabled = true;
    clearResults();
  }
});

runButton.addEventListener('click', runSolver);

loadExamples();
