(function() {
	'use strict';

	var DROPBOX_CLIENT_KEY = '1m07w66d6okvwry',
			SEND_MMS_ENDPOINT = 'http://localhost:3000/sendMms',
      PIXEL_INTENSITY_CHANGE_THRESHOLD = 0.2,
      FRAME_INTENSITY_CHANGE_THRESHOLD = 0.2;

	var app = angular.module('app', ['ngStorage']);

	app.controller('controller', function ($scope, $localStorage, $sessionStorage, $http) {
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
		$scope.getUserMediaSupported = !!navigator.getUserMedia;

		if (!$scope.getUserMediaSupported) {
			return;
		}

		$scope.localMediaStream = null;
		$scope.settings = $localStorage;
		$scope.settings.snapshotActions = $scope.settings.snapshotActions || { saveToDropbox: false, sendMms: false };

		var linkDropbox = function() {
			if ($scope.dropbox) {
				return;
			}

	    (new Dropbox.Client({ key: DROPBOX_CLIENT_KEY })).authenticate(function(err, client) {
	      if (err) {
	      	console.log(err);
	      	$scope.errorMessage = err;
	        return;
	      }

	      client.getAccountInfo(function(err, accountInfo) {
	        if (err) {
	        	console.log(err);
	        	$scope.errorMessage = err;
	          return;
	      	}

	      	$scope.$apply(function() {
	        	$scope.dropboxAccountInfo = accountInfo;
	        });
	      });

	      $scope.dropbox = client;
	    });
		};

		$scope.unlinkDropbox = function() {
			if (!$scope.dropbox) {
				return;
			}

			$scope.dropbox.signOut(function() {
				$scope.$apply(function() {
					delete $scope.dropbox;
					$scope.settings.snapshotActions.saveToDropbox = false;
				});
			});
		};

		var saveToDropbox = function(imageBlob) {
			var filename = (new Date()).toISOString() + '.png';
			$scope.dropbox.writeFile(filename, imageBlob, function(err, stat) {
				if (err) {
					$scope.errorMessage = err;
					return;
				}

				console.log(stat);
			});
		};

		$scope.$watch('settings.snapshotActions.saveToDropbox', function(newValue, oldValue) {
			if (newValue && !$scope.dropbox) {
				linkDropbox();
			}
		});

		var sendMms = function() {
			$http.post(
				SEND_MMS_ENDPOINT,
				{
					carrier: '',
					number: ''
				}
			).then(function(response) {

			}, function(err) {
				$scope.errorMessage = 'Error sending MMS: ' + err.status;
			});
		};

		var video = $('video#cam')[0],
		    buffer = $('canvas#buffer')[0],
		    ctx = $('canvas#buffer')[0].getContext('2d'),
		    currentSampleFrame = null,
        previousSampleFrame = null,
        sampleRate = 60, // sample rate in frames
        frameSinceLastSample = 0;

    var detectFrameChange = function(frame1, frame2) {
      var diff = 0;
      for (var i = 0; i < frame1.length; i += 4) {
        var r1 = frame1[i], g1 = frame1[i + 1], b1 = frame1[i + 2];
        var r2 = frame2[i], g2 = frame2[i + 1], b2 = frame2[i + 2];
        var i1 = 0.2989 * r1 + 0.5870 * g1 + 0.1140 * b1;
        var i2 = 0.2989 * r2 + 0.5870 * g2 + 0.1140 * b2;
        diff += Math.abs(i1 - i2) / 255 > PIXEL_INTENSITY_CHANGE_THRESHOLD;
      }

      return diff / (frame1.length / 4) > FRAME_INTENSITY_CHANGE_THRESHOLD;
    }

		var render = function() {
			ctx.drawImage(video, 0, 0);

      if (frameSinceLastSample++ > sampleRate) {
        previousSampleFrame = currentSampleFrame;
        currentSampleFrame = ctx.getImageData(0, 0, 640, 480).data;

        if (previousSampleFrame && currentSampleFrame && detectFrameChange(previousSampleFrame, currentSampleFrame)) {
          console.log('frame change detected');
          if ($scope.settings.autosave) {
            $scope.snapshot();
          }
        }

        frameSinceLastSample = 0;
      }

			requestAnimationFrame(render);
		};

		$scope.snapshot = function() {
			buffer.toBlob(function(blob) {
				if ($scope.settings.snapshotActions.saveToDropbox) {
					saveToDropbox(blob);
				}

				if ($scope.settings.snapshotActions.sendMms) {
					sendMms(blob);
				}
			});
		};

		navigator.getUserMedia({
				audio: false,
				video: true
			},
			function(stream) {
				$scope.localMediaStream = stream;
				$('video#cam').attr('src', window.URL.createObjectURL($scope.localMediaStream));
				requestAnimationFrame(render);
			},
			function(err) {
				$scope.errorMessage = 'Error getting user media: ' + err;
			}
		);
	});
})();