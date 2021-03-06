class StepDescriptor {
  /**
   * @param {Function} step - action, which will be carried out in the executing of this step
   * @param {Stepper} stepper - instance of Stepper, which contains this StepDescriptor
   * */
  constructor(step, stepper) {
    this.id = StepDescriptor.ID_COUNTER;
    StepDescriptor.ID_COUNTER++;

    this.stepper = stepper;
    this.action = step;
    this.execute = (data, done) => step(this, data, done);
  }

  id = 0;
  action;
  stepper;

  static ID_COUNTER = 0;

  /**
   * @param {*} [data]
   * */
  next = (data) => this.stepper.next(data, this);

  prev = (data = 1) => this.stepper.prev(data, this);

  remove = () => this.stepper.remove(this);

  /**
   * @param {*} data
   * */
  reject = (data) => this.stepper.reject(data);

  /**
   * @param {Function} step
   * @return {StepDescriptor}
   * */
  insertAfter = (step) => this.stepper.insertAfter(this, step);

  /**
   * @param {Function} step
   * @return {StepDescriptor}
   * */
  insertBefore = (step) => this.stepper.insertBefore(this, step);
}

export class Stepper {
  /**
   * @param {Function[]} steps - array of steps, which will be treated
   * @param {Function} [onReject] - callback, which will be executing on some step
   * */
  constructor(steps, onReject = () => null) {
    steps.forEach((step) => this.add(step));
    this.reject = onReject;
  }

  steps = [];
  reject;

  currentStep = null;

  /**
   * @param {*} [data]
   * @param {StepDescriptor} [stepDescriptor]
   * */
  next(data = null, stepDescriptor = null) {
    const isInitialStep = this.currentStep === null && stepDescriptor === null;
    const nextStepIndex = isInitialStep ? 0 : this.getIndex(stepDescriptor || this.currentStep) + 1;

    if (nextStepIndex < this.steps.length) {
      const isEnded = nextStepIndex === this.steps.length - 1;

      this.currentStep = stepDescriptor ? stepDescriptor : this.steps[nextStepIndex];
      this.steps[nextStepIndex].execute(data, isEnded);
    } else {
      throw new Error('Steps executing are ended. You cannot call "next" method.');
    }
  }

  /**
   * @param {Number} stepsCount - distance to step back
   * @param {StepDescriptor} stepDescriptor
   * @return {StepDescriptor}
   * */
  prev(stepsCount = 1, stepDescriptor = null) {
    const targetPos = this.getIndex(stepDescriptor || this.currentStep) - stepsCount;

    if (targetPos >= 0) {
      this.currentStep = this.steps[targetPos];

      return this.currentStep;
    } else {
      throw new Error(`Cannot step back on pos ${targetPos}`);
    }
  }

  /**
   * Start execution a queue from start
   * @param {*} data
   * */
  start(data) {
    this.currentStep = null;
    this.next(data);
  }

  /**
   * @param {StepDescriptor} stepDescriptor
   * */
  remove(stepDescriptor) {
    const removedStepIndex = this.getIndex(stepDescriptor);

    if (this.currentStep !== null && stepDescriptor.id === this.currentStep.id) {
      this.currentStep = this.steps[removedStepIndex - 1];
    }

    this.steps.splice(removedStepIndex, 1);
  }

  /**
   * @param {Function} step
   * @param {Number} index
   * @return {StepDescriptor}
   * */
  add(step, index = null) {
    const stepDescriptor = new StepDescriptor(step, this);

    if (index == null) {
      this.steps.push(stepDescriptor);
    } else {
      this.steps.splice(index, 0, stepDescriptor);
    }

    return stepDescriptor;
  }

  /**
   * @param {StepDescriptor} firstStepDescriptor
   * @param {StepDescriptor} secondStepDescriptor
   * */
  swap(firstStepDescriptor, secondStepDescriptor) {
    const firstIndex = this.getIndex(firstStepDescriptor);
    const secondIndex = this.getIndex(secondStepDescriptor);

    this.steps.splice(firstIndex, 1, secondStepDescriptor);
    this.steps.splice(secondIndex, 1, firstStepDescriptor);
  }

  /**
   * @param {StepDescriptor} stepDescriptor
   * @return {Number}
   * */
  getIndex(stepDescriptor) {
    const index = this.steps.findIndex((step) => stepDescriptor && step.id === stepDescriptor.id);

    if (index === -1) {
      throw new Error('Cannot find step in steps array');
    } else {
      return index;
    }
  }

  /**
   * @param {Number} index - position in steps array
   * @return {StepDescriptor}
   * */
  getStep(index) {
    return this.steps[index];
  }

  /**
   * @param {StepDescriptor} stepDescriptor - descriptor of the step before which will be inserted a new step
   * @param {Function} step - callback for the new step descriptor
   * @return {StepDescriptor}
   * */
  insertBefore(stepDescriptor, step) {
    return this.add(step, this.getIndex(stepDescriptor));
  }

  /**
   * @param {StepDescriptor} stepDescriptor - descriptor of the step after which will be inserted a new step
   * @param {Function} step - callback for the new step descriptor
   * @return {StepDescriptor}
   * */
  insertAfter(stepDescriptor, step) {
    return this.add(step, this.getIndex(stepDescriptor) + 1);
  }

  /**
   * Treats steps and return a sequence of all steps. It can not be edited.
   * In every step arguments will be a Object with "next" and "reject" methods.
   * @return {Function} first step
   * */
  sequence() {
    return sequence(this.steps.map(step => step.raw), this.reject);
  }
}

/**
 * @param {Function[]} steps
 * @param {Function} [reject]
 * */
export function sequence(steps, reject = () => null) {
  const hasSteps = !(steps.length - 1);
  const seq = steps.reduceRight((nextStep, step, index) => {
    const next = index === steps.length - 2 ? (
      (nextData) => nextStep({reject}, nextData, true)
    ) : (
      (nextData) => nextStep(nextData, false)
    );

    return (data, done) => step({next, reject}, data, done)
  });

  return (initialData) => seq(initialData, hasSteps);
}
