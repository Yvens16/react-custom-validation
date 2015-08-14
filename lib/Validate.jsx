import React from 'react';
import Promise from 'bluebird';
import Rx from 'rx';

export function and(rules) {
    return (value) => {
        return new Promise((resolve, reject) => {
            // Beginning to validate
            const valResults = rules.map((rule) => rule(value));
            valResults.forEach((resPromise) => {
                resPromise.then((result) => {
                    let index = 0;
                    while ((index < valResults.length) && (valResults[index].isFulfilled()) && (valResults[index].value() == null)) {
                        index++;
                    }
                    let firstRelevant = (index < valResults.length ? valResults[index] : valResults[valResults.length - 1]);
                    if (firstRelevant.isFulfilled()) {
                        // The promise is completed
                        resolve(firstRelevant.value());
                    } else { // eslint-disable-line 
                        // We don't know yet, if it's valid or which rule is first failed
                        // so just continue waiting
                    }
                });
            });
        });
    };
}


export class Validate extends React.Component {

    constructor(props) {
        super(props);
        // Collect rules (functions) & promisify
        // Rule functions should have signature (value, callback)
        this.rules = this.children.slice(1);
        this.subjectStream = new Rx.Subject();
        this.subscription = this.subjectStream
            .debounce(500)
            .startWith(this.input.props.value)
            .flatMapLatest(
                (value) => Rx.Observable.fromPromise(this.validate(value)))
            .subscribe(
                (validationResult) => this.props.onValidation(validationResult));
    }

    componentWillUnmount() {
        this.subjectStream.dispose();
    }

    buildValidationResponse(valid, error, showValidation) {
        return {
            'valid': valid,
            'error': error,
            'showValidation': showValidation
        };
    }

    onInputChange = (e) => {
        // Input has changed -> fire event, should not show validation
        this.props.onValidation(this.buildValidationResponse(null, null, false));
        this.subjectStream.onNext(e.target.value);
    }

    get children() {
        const c = this.props.children;
        return c instanceof Array ? c : [c];
    }

    get input() {
        return this.children[0];
    }

    validate(value) {
        this.props.onValidation(this.buildValidationResponse(null, null, true));
        return and(this.rules)(value).then((result) => {
            if (result == null) {
                // successfully (null or undefined)
                return this.buildValidationResponse(true, null, true);
            } else {
                // There is a rule, which was broken, but all rules prior to it
                // were followed => we found the breaking rule
                return this.buildValidationResponse(false, result, true);
            }
        });
    }

    mergeFunctions(...fns) {
        return (value) => fns
            .filter((f) => f != null)
            .forEach((f)=> f(value));
    }

    render() {
        return React.cloneElement(
            this.input,
            {
                'onChange': this.mergeFunctions(this.input.props.onChange, this.onInputChange)
            },
            this.input.props.children);
    }
}
