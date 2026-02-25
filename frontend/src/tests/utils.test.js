import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToast, updateStatus, log, debounce, initToast } from '../utils.js';

describe('utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showToast', () => {
    it('应该创建toast容器并显示消息', () => {
      showToast('测试消息', 'success');
      
      const container = document.getElementById('toast-container');
      expect(container).not.toBeNull();
      expect(container.children.length).toBe(1);
      expect(container.children[0].textContent).toBe('测试消息');
    });

    it('应该支持不同类型的toast', () => {
      initToast();
      showToast('成功', 'success');
      showToast('错误', 'error');
      showToast('警告', 'warning');
      showToast('信息', 'info');
      
      const container = document.getElementById('toast-container');
      expect(container).not.toBeNull();
      expect(container.children.length).toBe(4);
    });
  });

  describe('updateStatus', () => {
    it('应该更新指定元素的文本', () => {
      document.body.innerHTML = '<div id="test-status">原始文本</div>';
      
      updateStatus('test-status', '新文本');
      
      expect(document.getElementById('test-status').textContent).toBe('新文本');
    });

    it('元素不存在时不应报错', () => {
      expect(() => updateStatus('non-existent', '文本')).not.toThrow();
    });
  });

  describe('log', () => {
    it('应该调用console.log输出info级别日志', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      log('info', 'TestModule', '测试消息');
      
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][1]).toBe('测试消息');
    });

    it('应该调用console.error输出error级别日志', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      log('error', 'TestModule', '错误消息');
      
      expect(spy).toHaveBeenCalled();
    });

    it('应该调用console.warn输出warn级别日志', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      log('warn', 'TestModule', '警告消息');
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('debounce', () => {
    it('应该延迟执行函数', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      expect(fn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });

    it('多次调用应该只执行最后一次', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });
});
