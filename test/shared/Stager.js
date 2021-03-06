// Helper functions for FTP requests to report directory on Staging Server

// Modules
let Client = require('ssh2-sftp-client');
const CLIParser = require('./CLIParser.js');

// Path to staging report directory
let basePath = '/var/www/staging';

// Makes a connection, performs request specified via requestFunction, then closes connection
// If hideResult === true, don't print result returned by request
ftpRequest = (requestFunction, showResult = true) => {
  return new Promise(resolve => {
    try {
      console.log('Stager.js: establishing FTP connection');
      let client = new Client();
      let result;
      client.connect({
        host: 'staging.psychopy.org',
        port: CLIParser.parseOption({env: 'STAGING_PORT'}, true, CLIParser.logSilent),
        username: CLIParser.parseOption({env: 'STAGING_USERNAME'}, true, CLIParser.logSilent),
        password: CLIParser.parseOption({env: 'STAGING_PASSWORD'}, true, CLIParser.logSilent),
      }).then((data) => {
        console.log('Stager.js: performing request');
        return requestFunction(client, basePath);
      }).then((data) => {
        if (!showResult) {
          console.log('Stager.js: request resolved');
        } else {
          console.log('Stager.js: request resolved with data ' + JSON.stringify(data));
        }
        result = data;
        return client.end();
      }).then((data) => {
        resolve(result);
      }).catch((err) => {
        console.log('Stager.js: error during FTP connection: ' + err);
        resolve(result);
        return client.end();
      });
    } catch (err) {
      console.log('Stager.js: error during ftpRequest: ' + err);
      resolve(result);
    }
  });
};

// Upload directory
uploadDirectory = async (from, to) => {
  await ftpRequest((client, basePath) => {
    console.log('Stager.js: uploading directory from ' + from + ' to ' + basePath + '/' + to);
    return client.uploadDir(from, basePath + '/' + to);
  });
};

// Delete directory recursively
deleteDirectory = async (directory) => {
  await ftpRequest((client, basePath) => {
    console.log('Stager.js: deleting directory at ' + basePath + '/' + directory);
    return client.rmdir(basePath + '/' + directory, true);
  });
};

// Delete all subdirectories in containingDirectory except directoriesToKeep
deleteAllDirectoriesExcept = async (containingDirectory, directoriesToKeep) => {
  console.log('Stager.js: deleting all directories except ' + JSON.stringify(directoriesToKeep));
  let listResults = await ftpRequest((client) => {
    console.log('Stager.js: listing directories at ' + basePath + '/' + containingDirectory);
    return client.list(basePath + '/' + containingDirectory);
  }, false);
  console.log('Stager.js: ' + listResults.length + ' directories on staging server');
  let allDirectories = listResults.map((listResult) => {
    return listResult.name;
  })
  console.log('Stager.js: directory names on staging server are ' + JSON.stringify(allDirectories));
  let directoriesToDelete = allDirectories.filter((directory) => {
    return !directoriesToKeep.includes(directory);
  });
  console.log('Stager.js: directories to delete on staging server are ' + JSON.stringify(directoriesToDelete));
  for (directoryToDelete of directoriesToDelete) {
    await deleteDirectory(containingDirectory + '/' + directoryToDelete);
  }
}

// Construct a path (for reports on Stager) given branch, testrun, and test
createReportPath = (branch, testrun, test) => {
  let path = '';
  if (branch !== undefined) {
    path += branch;
  } else {
    return path;
  }
  if (testrun !== undefined) {
    path += '/' + testrun;
  } else {
    return path;
  }
  if (test !== undefined) {
    path += '/' + test;
  } 
  return path;
}

module.exports = {
  uploadDirectory: uploadDirectory,
  deleteDirectory: deleteDirectory,
  deleteAllDirectoriesExcept: deleteAllDirectoriesExcept,
  ftpRequest: ftpRequest,
  createReportPath: createReportPath
};