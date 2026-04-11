import { IrrigationWorkflow } from './IrrigationWorkflow';
import { FertilizationWorkflow } from './FertilizationWorkflow';
import { SprayWorkflow } from './SprayWorkflow';

export const WorkflowRouter = {
  pick: (userPrompt) => {
    const workflows = [SprayWorkflow, FertilizationWorkflow, IrrigationWorkflow];
    for (const wf of workflows) {
      if (wf.canHandle(userPrompt)) return wf;
    }
    return null;
  },
};

