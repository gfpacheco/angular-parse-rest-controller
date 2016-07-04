# angular-parse-rest-controller

This project's goal is to implement a new RESTController for Parse that uses Angular's `$http`.

With that we'll be able to use modules like `angular-loading-bar`.

## Installation

### Install with NPM

```sh
npm install --save angular-parse-rest-controller
```

### Install with Bower

```sh
bower install --save angular-parse-rest-controller
```

## Setup

### Load the script

Add the `dist/angular-parse-rest-controller.min.js` to your HTML file.

### Add as dependency

Add `parse.restController` module as a dependency of your Angular app:

```javascript
angular.module('yourModule', ['parse.restController']);
```

## Contributing

Again, this is an early stage project, any help is appreciated, feel free to open issues and submit
pull requests.
