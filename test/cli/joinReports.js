// Downloads the merged reports of each testrun, joins them together, summarizes them, and uploads the result
// Upload or delete test on Stager via CLI arguments

// Modules
const Stager = require('../shared/Stager.js');
const ReportSummarizer = require('../shared/ReportSummarizer.js');
const fs = require('fs');
const Paths = require('../shared/Paths.js');
const CLIParser = require('../shared/CLIParser.js');

// Get branch 
let branch = CLIParser.parseOption({env: 'GITHUB_REF', cli: 'branch'});

// Get testrun
let testrun = CLIParser.parseOption({cli: 'testrun'});

// Join reports
(async () => {
  // Get all testruns of branch
  let listResults = await Stager.ftpRequest((client, basePath) => {
    return client.list(basePath + '/report/' + Stager.createReportPath(branch, testrun));
  }, false);
  // Filter out directories
  listResults = listResults.filter((listResult) => {
    return listResult.type === 'd';
  });
  // Get names of tests
  let tests = listResults.map((listResult) => {
    return listResult.name;
  })
  console.log('joinReports.js: Found ' + tests.length + ' tests');
  // Merge reports of each test together
  let joinedReports = [], report, getResults;
  for (let test of tests) {
    console.log('joinReports.js: Adding test ' + test);
    getResults = await Stager.ftpRequest((client, basePath) => {
      return client.get(basePath + '/report/' + Stager.createReportPath(branch, testrun, test) + '/' + Paths.subdir_logs_processed + '/report.json');
    }, false);
    report = JSON.parse(getResults);
    joinedReports = joinedReports.concat(report);
  }
  // Create a tmp folder if it doesn't exist yet
  if (!fs.existsSync(Paths.dir_tmp)) {
    fs.mkdirSync(Paths.dir_tmp);
  };  
  // Create a logs_joined folder if it doesn't exist yet
  if (!fs.existsSync(Paths.dir_logs_joined)) {
    fs.mkdirSync(Paths.dir_logs_joined);
  };    
  // Store joined reports
  ReportSummarizer.writeJsonAndCsv(Paths.dir_logs_joined + '/report', joinedReports);
  // Summarize reports
  let summaries = ReportSummarizer.summarize(joinedReports, ['platform']);
  // Store summaries
  ReportSummarizer.writeJsonAndCsv(Paths.dir_logs_joined + '/summary', summaries);
  // Store summaries of all tests with at least on fail
  let summariesFailed = summaries.filter( (summary) => {
    return summary.failed > 0
  })
  // Store failed
  ReportSummarizer.writeJsonAndCsv(Paths.dir_logs_joined + '/failed', summariesFailed);
  // Merge together in an XLSX file
  ReportSummarizer.writeXLSX(Paths.dir_logs_joined + '/combined_report.xlsx', {
    failed: summariesFailed,
    summary: summaries,
    report: joinedReports
  });
  // Upload to stager
  await Stager.uploadDirectory(Paths.dir_logs_joined, 'report/'  + Stager.createReportPath(branch, testrun));
})();


