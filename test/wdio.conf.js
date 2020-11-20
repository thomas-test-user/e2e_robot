// Modules 
const fs = require('fs');
const Jimp = require('jimp');
const VisualRegressor = require('./shared/VisualRegressor.js');
const ReportSummarizer = require('./shared/ReportSummarizer.js');
const BrowserStack = require('./shared/BrowserStack.js');
const Stager = require('./shared/Stager.js');
const Paths = require('./shared/Paths.js');
const CLIParser = require('./shared/CLIParser.js');

// *** Parse CLI arguments
// Parse server CLI option
const server = CLIParser.parseOption({cli: 'server'});
console.log(server);
if (!(['local', 'bs'].includes(server))) {
  throw new Error('wdio.conf.js: The server option (' + server + ') was not recognized. Use "local" for local server or "bs" for BrowserStack.');
}

// Parse upload CLI option
let upload = CLIParser.parseOption({cli: 'upload'}, false);
upload = upload !== undefined && upload === 'yes';

// Parse platform CLI option
let platform = CLIParser.parseOption({cli: 'platform'}, false);
platform = platform === undefined? '*': platform;

// Parse test CLI option
let test = CLIParser.parseOption({cli: 'test'}, false);
let specs, specFile;
if (test === undefined) {
  test = 'all_tests';
  specFile = 'all_tests'
  specs = ['./test/specs/' + specFile + '.js'];  
  console.log('wdio.conf.js: no test specified, so running all tests');
} else {
  specFile = 'single_test';
  specs = ['./test/specs/' + specFile + '.js'];
  console.log('wdio.conf.js: test is ' + test);
}

// Get branch from CLI or TRAVIS_BRANCH
let branch;
if (upload || server === 'bs') {
  branch = CLIParser.parseOption({env: 'GITHUB_REF', cli: 'branch'});
}

// Get subset from CLI
let subset =  CLIParser.parseOption({cli: 'subset'}, false);
subset = subset !== undefined;

// *** WebdriverIO config
exports.config = {
  // Connect to browserstack is server is 'bs'
  user: server === 'bs' ? CLIParser.parseOption({env: 'BROWSERSTACK_USER'}, true, CLIParser.logSilent): undefined,
  key: server === 'bs' ? CLIParser.parseOption({env: 'BROWSERSTACK_ACCESSKEY'}, true, CLIParser.logSilent): undefined,

  // Number of instances run at same time
  maxInstances: 3, // 3

  // Local (local) or BrowserStack (bs) capabilities
  capabilities: require('./shared/capabilities.' + server).getCapabilities(test + ':' + branch, platform, subset),

  // Local test-runner
  runner: 'local',

  // Test files & patterns to include & exclude
  specs: specs,
  exclude: [],
  //
  // ===================
  // Test Configurations
  // ===================
  // Define all options that are relevant for the WebdriverIO instance here
  //
  // Level of logging verbosity: trace | debug | info | warn | error | silent
  logLevel: 'warn',
  //
  // Set specific log levels per logger
  //    logLevels: {
  //        webdriver: 'debug',
  //        '@wdio/applitools-service': 'debug',
  //        '@wdio/browserstack-service': 'debug'
  //    },
  logLevels: {
    webdriver: 'silent',
    '@wdio/applitools-service': 'silent',
    '@wdio/browserstack-service': 'silent'
  },
  outputDir: Paths.dir_logs_raw,

  // Give up after X tests have failed (0 - don't bail)
  bail: 0,
  //
  // String prepended to each url
  baseUrl: '',

  // Default timeout for all waitFor* commands.
  waitforTimeout: 1000,

  // Test runner services
  services: server === 'bs' ? [] :
    [
      // Selenium-standalone; takes care of local browserdrivers 
      ['selenium-standalone', {
        logPath: Paths.dir_logs_selenium,
        installArgs: {
          drivers: {
            chrome: { version: '84.0.4147.30' },
            firefox: { version: '0.26.0' },
            MicrosoftEdge: { version: '84.0.522.40' }
          }
        },
        args: {
          drivers: {
            chrome: { version: '84.0.4147.30' },
            firefox: { version: '0.26.0' },
            MicrosoftEdge: { version: '84.0.522.40' }
          }
        }
      }]
    ],

  // Framework settings
  framework: 'jasmine',
  // The number of times to retry the entire specfile when it fails as a whole
  specFileRetries: server === 'bs' ? 0:0,//2 : 0,
  // Whether or not retried specfiles should be retried immediately or deferred to the end of the queue
  specFileRetriesDeferred: true,
  // Options to be passed to Jasmine.
  jasmineNodeOpts: {
    // Jasmine default timeout
    defaultTimeoutInterval: 90000,
    // Fail whole suite after first failed spec
    failFast: true,
    //
    // The Jasmine framework allows interception of each assertion in order to log the state of the application
    // or website depending on the result. For example, it is pretty handy to take a screenshot every time
    // an assertion fails.
    expectationResultHandler: function (passed, assertion) {
      // do something
    }
  },

  // Test reporters
  reporters: [
    'dot',
    ['json', {
      outputDir: Paths.dir_logs_json,
      stdout: false
    }]
  ],

  // =====
  // Hooks
  // =====
  /**
   * Gets executed once before all workers get launched.
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   */
  onPrepare: function (config, capabilities) {
    // *** Setup temporary directories
    // Construct tmp dir
    if (!fs.existsSync(Paths.dir_tmp)) {
      console.log('Creating directory: ' + Paths.dir_tmp)
      fs.mkdirSync(Paths.dir_tmp);
    };
    // Construct or clean up log dirs
    let logDirs = [
      Paths.dir_logs_capabilities,
      Paths.dir_logs_json,
      Paths.dir_logs_processed,
      Paths.dir_logs_raw,
      Paths.dir_logs_selenium,
      Paths.dir_screenshots_cutout,
      Paths.dir_screenshots_raw,
      Paths.dir_screenshots_scaled,
    ];      
    let files;
    for (let logDir of logDirs) {
      if (!fs.existsSync(logDir)) {
        console.log('Creating directory: ' + logDir);
        fs.mkdirSync(logDir);
      } else {
        console.log('Deleting files in directory: ' + logDir);
        files = fs.readdirSync(logDir);
        for (let file_i in files) {
          fs.unlinkSync(logDir + '/' + files[file_i]);
        }
      }
    }
    // *** Delete old test logs
    console.log('Deleting BrowserStack logs of build ' + test + ':' + branch);
    BrowserStack.deleteOneTest(test + ':' + branch);
    // *** Log all capabilities
    fs.writeFileSync(Paths.dir_logs_capabilities + '/capabilities.json', JSON.stringify(capabilities));
  },
  /**
   * Gets executed before test execution begins. At this point you can access to all global
   * variables like `browser`. It is the perfect place to define custom commands.
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that are to be run
   */
  before: function (capabilities, specs) {
    //console.log(this)

    // These function concern getting capabilities that are specified
    // in the config but not available in browser.capabilities during
    // the test run.
    browser.addCommand('getPlatformName', () => {
      return capabilities['bstack:options'].sessionName;
    });
    browser.addCommand('getOsName', () => {
      return capabilities['bstack:options'].os;
    });
    browser.addCommand('getDeviceName', () => {
      return capabilities['bstack:options'].deviceName;
    });
   
    // Get resolution depending on OS and whether we're running local
    browser.addCommand('getResolution', () => {
      // Local; return a dummy resolution (1x1)
      if (browser.runningLocal()) {
        return "1x1";
      }
      let os = browser.getOsName();
      if (os === "OS X" || os === "Windows") {
        return capabilities['bstack:options'].resolution;
      } else if (os === "Android") {
        return browser.capabilities.deviceScreenSize;
      } else {
        // iOS, lookup from table
        return {
          'iPhone XS': '1125x2436',
          'iPhone 11 Pro Max': '1242x2688',
          'iPhone 11 Pro': '1125x2436',
          'iPhone 11': '828x1792',
          'iPhone 8': '750x1334',
          'iPhone SE 2020': '750x1334',
          'iPad Pro 12.9 2020': '2048x2732',
          'iPad Pro 12.9 2018': '2048x2732',
          'iPad Pro 11 2020': '1668x2388',
          'iPad 7th': '1620x2160'
        }[browser.getDeviceName()];
      }
    });
    // returns pointer type for use in Actions API
    browser.addCommand('getPointerType', () => {
      return browser.isMobile ? "touch" : "mouse";
    });    
    // returns true if we're running a local Selenium server
    browser.addCommand('runningLocal', () => {
      return server === 'local';
    });    
    // Making screenshots and saving them
    browser.addCommand('writeJimpImg', (img, name) => {
      img.write(Paths.dir_screenshots_raw + '/' + name + '#' + browser.getPlatformName() + '.png');
    });
    browser.addCommand('getJimpScreenshot', async () => {
      let screenshotBase64 = await browser.takeScreenshot();
      return (await Jimp.read(new Buffer.from(screenshotBase64, 'base64')));
    });
    browser.addCommand('writeScreenshot', (name) => {
      browser.writeJimpImg(browser.getJimpScreenshot(), name);
    });
    // Perform a visual regression test
    browser.addCommand('compareScreenshot', async (name) => {
      // Make screenshot
      let screenshotImg = await browser.getJimpScreenshot();
      // Write screenshot to file
      browser.writeJimpImg(screenshotImg, name);
      // Get reference
      let referenceImg = await VisualRegressor.getReferenceImg(name);
      // If reference available, perform comparison
      if (referenceImg === null) {
        // No reference; test passed
        return true;
      } else {
        // Yes reference, compare
        let platformName = await browser.getPlatformName();
        let comparisonResult = await VisualRegressor.compareScreenshotWithReference(
          screenshotImg,
          referenceImg,
          name + '#' + platformName + '.png'
        );
        // Add results to log
        for (let comparisonResultKey in comparisonResult) {
          browser.logAdd(
            name + '.' + comparisonResultKey,
            comparisonResult[comparisonResultKey]
          );
        }
        // Return RMS value
        return comparisonResult.rms;
      }
    });
    // Get current branch
    browser.addCommand('getBranch', () => {
      return branch;
    });

    // Managing custom log-file
    browser.addCommand('logInit', () => {
      browser.capabilities.customLogs = {};
    });
    browser.addCommand('logAdd', (key, value) => {
      browser.capabilities.customLogs[key] = value;
    });
    browser.addCommand('logGet', () => {
      return browser.capabilities.customLogs;
    });

    // Get test
    browser.addCommand('getTest', () => {
      return test;
    });

    // Print current sessionId and platformName
    console.log('sessionId: ' + browser.sessionId);
    console.log('platformName: ' + browser.getPlatformName())
    // Init custom log
    browser.logInit();
    browser.logAdd('platform', browser.getPlatformName())
    browser.logAdd('resolution', browser.getResolution());
  },
  /**
   * Gets executed after all workers got shut down and the process is about to exit. An error
   * thrown in the onComplete hook will result in the test run failing.
   * @param {Object} exitCode 0 - success, 1 - fail
   * @param {Object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {<Object>} results object containing test results
   */
  onComplete: async function (exitCode, config, capabilities, results) {
    // Merge reports
    let joinedReports = ReportSummarizer.merge(['custom', specFile], test);
    // Store merged reports
    ReportSummarizer.writeJsonAndCsv(Paths.dir_logs_processed + '/' + 'report', joinedReports);
    // Summarize reports
    let summaries = ReportSummarizer.summarize(joinedReports, ['platform']);
    // Store summaries
    ReportSummarizer.writeJsonAndCsv(Paths.dir_logs_processed + '/' + 'summary', summaries);
    // Store summaries of all tests with at least on fail
    let summariesFailed = summaries.filter( (summary) => {
      return summary.failed > 0
    })
    ReportSummarizer.writeJsonAndCsv(Paths.dir_logs_processed + '/' + 'failed', summariesFailed);
    // Store failed, summaries, and reports in a single XLSX
    ReportSummarizer.writeXLSX(Paths.dir_logs_processed + '/' + 'combined_report.xlsx', {
      failed: summariesFailed,
      summary: summaries,
      report: joinedReports
    });
    // If upload enabled, update stager
    if (upload) {
      // Delete old logs
      await Stager.deleteDirectory('report/' + branch + '/' + test);
      // Upload logs
      await Stager.uploadDirectory(Paths.dir_tmp, 'report/' + branch + '/' + test);
    }
  },

  afterTest: function (test, context, { error, result, duration, passed, retries }) {
    // console.log('afterTest');
    // console.log(test);
    // console.log(context);
    // console.log(error);
    // console.log(result);
  }
}
