class AIGatekeeperImpl {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 1;
    this.activeCount = 0;
  }

  async run(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    this.activeCount++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      // Small delay between requests to prevent rapid-fire triggers
      setTimeout(() => this.process(), 200);
    }
  }
}

export const AIGatekeeper = new AIGatekeeperImpl();
