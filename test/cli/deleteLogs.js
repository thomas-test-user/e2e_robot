// Delete logs of a banch/testrun/test in BrowserStack and on Stager

// *** Modules
const BrowserStack = require('../shared/BrowserStack.js');
const Stager = require('../shared/Stager.js');
const CLIParser = require('../shared/CLIParser.js');

// Get branch, testrun, and test
const branch = CLIParser.parseOption({cli: 'branch', env: 'GITHUB_REF'}, false);
const testrun = CLIParser.parseOption({cli: 'testrun'}, false);
const test = CLIParser.parseOption({cli: 'test'}, false);

// Delete BrowserStack logs
const buildPrefix = BrowserStack.createBuildName(branch, testrun, test);
BrowserStack.deleteAllBuildsStartingWith(buildPrefix);

// Delete Stager reports
const stagerPath = Stager.createReportPath(branch, testrun, test);
Stager.deleteDirectory('report/' + stagerPath);
